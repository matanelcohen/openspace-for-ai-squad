/**
 * End-to-end tests for the tool registry.
 *
 * Tests the full lifecycle: register providers → discover tools → invoke them,
 * simulating how an agent would interact with the tool system.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';

import { FileOpsAdapter } from '../adapters/file-ops-adapter.js';
import { GitAdapter } from '../adapters/git-adapter.js';
import { SearchAdapter } from '../adapters/search-adapter.js';
import { CustomToolManager } from '../custom-tool-manager.js';
import { BaseToolProvider } from '../plugin-interface.js';
import { ToolRegistry } from '../tool-registry.js';
import type {
  CustomToolDescriptor,
  CustomToolsConfigFile,
  RegistryEvent,
  ToolDescriptor,
} from '../types.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeDescriptor(overrides: Partial<ToolDescriptor> = {}): ToolDescriptor {
  return {
    id: 'e2e-tool',
    name: 'E2E Tool',
    description: 'An end-to-end test tool',
    version: '1.0.0',
    category: 'custom',
    parameters: [],
    ...overrides,
  };
}

class MockProvider extends BaseToolProvider {
  readonly name: string;
  private readonly handler: (toolId: string, params: Record<string, unknown>) => Promise<unknown>;
  initCalled = false;
  shutdownCalled = false;

  constructor(
    name: string,
    tools: ToolDescriptor[],
    handler?: (toolId: string, params: Record<string, unknown>) => Promise<unknown>,
  ) {
    super();
    this.name = name;
    this.tools = tools;
    this.handler = handler ?? (() => Promise.resolve({ ok: true }));
  }

  async execute(toolId: string, params: Record<string, unknown>): Promise<unknown> {
    return this.handler(toolId, params);
  }

  async initialize(): Promise<void> {
    this.initCalled = true;
  }

  async shutdown(): Promise<void> {
    this.shutdownCalled = true;
  }
}

// ── E2E Tests ──────────────────────────────────────────────────────

describe('E2E: Tool Registry Full Flow', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  afterEach(async () => {
    await registry.shutdown();
  });

  describe('agent discovers and invokes tools dynamically', () => {
    it('full lifecycle: register → discover → invoke → unregister', async () => {
      // Phase 1: Register multiple providers
      const mathProvider = new MockProvider(
        'math',
        [
          makeDescriptor({
            id: 'math-add',
            name: 'Add Numbers',
            category: 'custom',
            parameters: [
              { name: 'a', type: 'number', description: 'First number', required: true },
              { name: 'b', type: 'number', description: 'Second number', required: true },
            ],
          }),
          makeDescriptor({
            id: 'math-multiply',
            name: 'Multiply Numbers',
            category: 'custom',
            parameters: [
              { name: 'a', type: 'number', description: 'First number', required: true },
              { name: 'b', type: 'number', description: 'Second number', required: true },
            ],
          }),
        ],
        async (toolId, params) => {
          if (toolId === 'math-add') return (params.a as number) + (params.b as number);
          if (toolId === 'math-multiply') return (params.a as number) * (params.b as number);
          throw new Error('Unknown tool');
        },
      );

      const textProvider = new MockProvider(
        'text',
        [
          makeDescriptor({
            id: 'text-upper',
            name: 'Uppercase Text',
            category: 'custom',
            parameters: [
              { name: 'text', type: 'string', description: 'Text to uppercase', required: true },
            ],
          }),
        ],
        async (_toolId, params) => (params.text as string).toUpperCase(),
      );

      await registry.registerProvider(mathProvider);
      await registry.registerProvider(textProvider);

      // Phase 2: Agent discovers available tools
      const allTools = registry.discover();
      expect(allTools).toHaveLength(3);

      // Phase 3: Agent invokes tools
      const addResult = await registry.invoke({
        toolId: 'math-add',
        parameters: { a: 5, b: 3 },
      });
      expect(addResult.success).toBe(true);
      expect(addResult.data).toBe(8);

      const mulResult = await registry.invoke({
        toolId: 'math-multiply',
        parameters: { a: 4, b: 7 },
      });
      expect(mulResult.success).toBe(true);
      expect(mulResult.data).toBe(28);

      const upperResult = await registry.invoke({
        toolId: 'text-upper',
        parameters: { text: 'hello world' },
      });
      expect(upperResult.success).toBe(true);
      expect(upperResult.data).toBe('HELLO WORLD');

      // Phase 4: Unregister a provider
      await registry.unregisterProvider('math');
      expect(registry.discover()).toHaveLength(1);
      expect(registry.getTool('math-add')).toBeUndefined();

      // Phase 5: Invoking unregistered tool returns error
      const missingResult = await registry.invoke({
        toolId: 'math-add',
        parameters: { a: 1, b: 2 },
      });
      expect(missingResult.success).toBe(false);
      expect(missingResult.error?.code).toBe('TOOL_NOT_FOUND');
    });

    it('agent filters tools by category and name to find the right tool', async () => {
      // Register mixed providers
      await registry.registerProvider(
        new MockProvider('git-prov', [
          makeDescriptor({ id: 'git-status', name: 'Git Status', category: 'git' }),
          makeDescriptor({ id: 'git-log', name: 'Git Log', category: 'git' }),
        ]),
      );
      await registry.registerProvider(
        new MockProvider('file-prov', [
          makeDescriptor({ id: 'file-read', name: 'Read File', category: 'file' }),
          makeDescriptor({ id: 'file-write', name: 'Write File', category: 'file' }),
        ]),
      );
      await registry.registerProvider(
        new MockProvider('search-prov', [
          makeDescriptor({ id: 'search-grep', name: 'Grep Search', category: 'search' }),
        ]),
      );

      // Agent needs a git tool
      const gitTools = registry.discover({ category: 'git' });
      expect(gitTools).toHaveLength(2);

      // Agent searches by name
      const logTool = registry.discover({ name: 'Log' });
      expect(logTool).toHaveLength(1);
      expect(logTool[0]!.id).toBe('git-log');

      // Agent combines filters
      const fileWrite = registry.discover({ category: 'file', name: 'Write' });
      expect(fileWrite).toHaveLength(1);
      expect(fileWrite[0]!.id).toBe('file-write');

      // Agent searches for non-matching
      expect(registry.discover({ category: 'api' })).toHaveLength(0);
    });
  });

  describe('multi-provider interaction', () => {
    it('providers are initialized in order and shut down on cleanup', async () => {
      const order: string[] = [];

      const p1 = new MockProvider('first', [makeDescriptor({ id: 'tool-aa' })]);
      vi.spyOn(p1, 'initialize').mockImplementation(async () => {
        order.push('init-first');
      });
      vi.spyOn(p1, 'shutdown').mockImplementation(async () => {
        order.push('shutdown-first');
      });

      const p2 = new MockProvider('second', [makeDescriptor({ id: 'tool-bb' })]);
      vi.spyOn(p2, 'initialize').mockImplementation(async () => {
        order.push('init-second');
      });
      vi.spyOn(p2, 'shutdown').mockImplementation(async () => {
        order.push('shutdown-second');
      });

      await registry.registerProvider(p1);
      await registry.registerProvider(p2);

      expect(order).toEqual(['init-first', 'init-second']);

      await registry.shutdown();
      expect(order).toContain('shutdown-first');
      expect(order).toContain('shutdown-second');
    });

    it('tracks events across the full lifecycle', async () => {
      const events: RegistryEvent[] = [];
      registry.on((e) => events.push(e));

      const provider = new MockProvider(
        'evt-provider',
        [makeDescriptor({ id: 'evt-tool' })],
        async () => 'result',
      );
      await registry.registerProvider(provider);

      await registry.invoke({ toolId: 'evt-tool', parameters: {} });
      registry.unregister('evt-tool');

      const types = events.map((e) => e.type);
      expect(types).toContain('tool:registered');
      expect(types).toContain('tool:invoked');
      expect(types).toContain('tool:unregistered');

      // All events have timestamps
      for (const event of events) {
        expect(event.timestamp).toBeGreaterThan(0);
        expect(event.toolId).toBe('evt-tool');
      }
    });
  });

  describe('built-in adapters integration', () => {
    it('registers built-in git + file adapters and invokes them', async () => {
      const tmpDir = await mkdtemp(join(tmpdir(), 'e2e-builtin-'));

      try {
        // Register built-in adapters
        const fileAdapter = new FileOpsAdapter(tmpDir);
        await registry.registerProvider(fileAdapter);

        // Discover file tools
        const fileTools = registry.discover({ category: 'file' });
        expect(fileTools.length).toBeGreaterThanOrEqual(5);

        // Use file tools end-to-end via the registry
        const writeResult = await registry.invoke({
          toolId: 'file-write',
          parameters: { path: 'e2e-test.txt', content: 'E2E test content' },
        });
        expect(writeResult.success).toBe(true);

        const readResult = await registry.invoke({
          toolId: 'file-read',
          parameters: { path: 'e2e-test.txt' },
        });
        expect(readResult.success).toBe(true);
        expect(readResult.data).toBe('E2E test content');

        // Stat the file
        const statResult = await registry.invoke({
          toolId: 'file-stat',
          parameters: { path: 'e2e-test.txt' },
        });
        expect(statResult.success).toBe(true);
        expect((statResult.data as { isFile: boolean }).isFile).toBe(true);

        // List directory
        const listResult = await registry.invoke({
          toolId: 'file-list',
          parameters: { path: '.' },
        });
        expect(listResult.success).toBe(true);
        const entries = listResult.data as Array<{ name: string }>;
        expect(entries.some((e) => e.name === 'e2e-test.txt')).toBe(true);

        // Delete the file
        const deleteResult = await registry.invoke({
          toolId: 'file-delete',
          parameters: { path: 'e2e-test.txt' },
        });
        expect(deleteResult.success).toBe(true);
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('registers git adapter and discovers git tools', async () => {
      const gitAdapter = new GitAdapter();
      await registry.registerProvider(gitAdapter);

      const tools = registry.discover({ category: 'git' });
      expect(tools.length).toBeGreaterThanOrEqual(4);

      const toolIds = tools.map((t) => t.id);
      expect(toolIds).toContain('git-status');
      expect(toolIds).toContain('git-log');
      expect(toolIds).toContain('git-diff');
      expect(toolIds).toContain('git-blame');
    });

    it('registers search adapter and discovers search tools', async () => {
      const searchAdapter = new SearchAdapter();
      await registry.registerProvider(searchAdapter);

      const tools = registry.discover({ category: 'search' });
      expect(tools.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('custom tool manager integration', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'e2e-custom-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('full flow: create config → register custom tools → discover → invoke', async () => {
      const configPath = join(tmpDir, 'tools.config.yaml');

      // Create a custom CLI tool via config
      const customTool: CustomToolDescriptor = {
        id: 'echo-custom',
        name: 'Echo Custom',
        description: 'Echoes input via custom tool system',
        version: '1.0.0',
        category: 'custom',
        parameters: [
          { name: 'message', type: 'string', description: 'Message to echo', required: true },
        ],
        execution: {
          mode: 'cli-command',
          command: 'echo',
          args: ['{{message}}'],
          parseOutput: 'text',
        },
      };

      const config: CustomToolsConfigFile = { version: 1, tools: [customTool] };
      await writeFile(configPath, stringifyYaml(config));

      // Start the custom tool manager
      const manager = new CustomToolManager({
        configPath,
        watchEnabled: false,
      });
      const loadResult = await manager.start(registry);
      expect(loadResult.loaded).toBe(1);

      // Discover the custom tool via registry
      const customTools = registry.discover({ category: 'custom' });
      expect(customTools.some((t) => t.id === 'echo-custom')).toBe(true);

      // Invoke the custom tool via registry
      const result = await registry.invoke({
        toolId: 'echo-custom',
        parameters: { message: 'hello from e2e' },
      });
      expect(result.success).toBe(true);
      expect((result.data as { stdout: string }).stdout.trim()).toBe('hello from e2e');

      await manager.stop();
    });

    it('adds a tool from template and invokes it', async () => {
      const configPath = join(tmpDir, 'tools.config.yaml');
      const manager = new CustomToolManager({
        configPath,
        watchEnabled: false,
      });
      await manager.start(registry);

      // Add tool from CLI command template with valid overrides
      const desc = await manager.addToolFromTemplate('cli-command-wrapper', {
        id: 'echo-from-template',
        name: 'Echo From Template',
        description: 'Echoes via template',
      });

      expect(desc.execution.mode).toBe('cli-command');

      // Discover & invoke
      const tools = registry.discover({ id: 'echo-from-template' });
      expect(tools).toHaveLength(1);

      const result = await registry.invoke({
        toolId: 'echo-from-template',
        parameters: { input: 'template test' },
      });
      expect(result.success).toBe(true);

      await manager.stop();
    });
  });

  describe('config-driven tool loading via loadFromFile', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'e2e-load-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('loads tools from JSON config and invokes them', async () => {
      const configFile = join(tmpDir, 'tools.json');
      const config = {
        tools: [
          makeDescriptor({
            id: 'loaded-echo',
            name: 'Loaded Echo',
            category: 'custom',
            parameters: [{ name: 'msg', type: 'string', description: 'Message', required: true }],
          }),
        ],
      };
      await writeFile(configFile, JSON.stringify(config));

      const provider = new MockProvider(
        'json-loader',
        [config.tools[0]!],
        async (_toolId, params) => `Echo: ${params.msg}`,
      );

      const result = await registry.loadFromFile(configFile, provider);
      expect(result.loaded).toBe(1);

      // Invoke the loaded tool
      const invokeResult = await registry.invoke({
        toolId: 'loaded-echo',
        parameters: { msg: 'hello' },
      });
      expect(invokeResult.success).toBe(true);
      expect(invokeResult.data).toBe('Echo: hello');
    });

    it('loads tools from YAML config', async () => {
      const configFile = join(tmpDir, 'tools.yaml');
      const yaml = `tools:
  - id: yaml-tool
    name: YAML Tool
    description: A tool loaded from YAML
    version: "1.0.0"
    category: custom
    parameters: []
`;
      await writeFile(configFile, yaml);

      const provider = new MockProvider(
        'yaml-loader',
        [makeDescriptor({ id: 'yaml-tool' })],
        async () => 'yaml result',
      );

      const result = await registry.loadFromFile(configFile, provider);
      expect(result.loaded).toBe(1);
      expect(registry.getTool('yaml-tool')).toBeDefined();
    });
  });
});
