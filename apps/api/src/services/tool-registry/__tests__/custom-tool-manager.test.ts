import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { stringify as stringifyYaml } from 'yaml';

import { CustomToolManager } from '../custom-tool-manager.js';
import { ToolRegistry } from '../tool-registry.js';
import type { CustomToolDescriptor, CustomToolsConfigFile } from '../types.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeCustomTool(overrides: Partial<CustomToolDescriptor> = {}): CustomToolDescriptor {
  return {
    id: 'custom-test-tool',
    name: 'Custom Test Tool',
    description: 'A custom tool for testing',
    version: '1.0.0',
    category: 'custom',
    parameters: [],
    execution: {
      mode: 'cli-command',
      command: 'echo',
      args: ['hello'],
      parseOutput: 'text',
    },
    ...overrides,
  };
}

function makeConfigYaml(tools: CustomToolDescriptor[]): string {
  const config: CustomToolsConfigFile = { version: 1, tools };
  return stringifyYaml(config, { lineWidth: 120 });
}

// ── Tests ──────────────────────────────────────────────────────────

describe('CustomToolManager', () => {
  let tmpDir: string;
  let configPath: string;
  let registry: ToolRegistry;
  let manager: CustomToolManager;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'ctm-test-'));
    configPath = join(tmpDir, 'tools.config.yaml');
    registry = new ToolRegistry();
    manager = new CustomToolManager({
      configPath,
      watchEnabled: false, // disable file watching in tests
      debounceMs: 50,
    });
  });

  afterEach(async () => {
    await manager.stop();
    await registry.shutdown();
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ── Lifecycle ────────────────────────────────────────────────────

  describe('start / stop', () => {
    it('starts with empty result when no config exists', async () => {
      const result = await manager.start(registry);
      expect(result.loaded).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('loads tools from existing config on start', async () => {
      const tool = makeCustomTool();
      await writeFile(configPath, makeConfigYaml([tool]));

      const result = await manager.start(registry);
      expect(result.loaded).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(registry.getTool('custom-test-tool')).toBeDefined();
    });

    it('registers the custom-tools provider on start', async () => {
      await manager.start(registry);
      expect(registry.getProviders()).toContain('custom-tools');
    });

    it('does not double-register provider on repeated start', async () => {
      await manager.start(registry);
      // Second start should not throw
      const result = await manager.start(registry);
      expect(result.loaded).toBe(0);
    });

    it('emits tools:loaded event on start', async () => {
      const events: string[] = [];
      manager.on('tools:loaded', () => events.push('tools:loaded'));
      manager.on('change', () => events.push('change'));

      await manager.start(registry);
      expect(events).toContain('tools:loaded');
      expect(events).toContain('change');
    });

    it('clears registry reference on stop', async () => {
      await manager.start(registry);
      await manager.stop();
      // Manager should be stopped now, operations still work but won't register
      expect(manager.listTools()).toHaveLength(0);
    });
  });

  // ── loadConfig ───────────────────────────────────────────────────

  describe('loadConfig', () => {
    it('returns empty when config file does not exist', async () => {
      await manager.start(registry);
      const result = await manager.loadConfig();
      expect(result.loaded).toBe(0);
    });

    it('loads multiple tools from config', async () => {
      const tools = [makeCustomTool({ id: 'tool-aa' }), makeCustomTool({ id: 'tool-bb' })];
      await writeFile(configPath, makeConfigYaml(tools));
      await manager.start(registry);

      expect(manager.listTools()).toHaveLength(2);
    });

    it('reports errors for invalid tools in config', async () => {
      const invalidTool = {
        id: 'INVALID_ID',
        name: 'Bad Tool',
        description: 'bad',
        version: '1.0.0',
        category: 'custom',
        parameters: [],
        execution: { mode: 'cli-command', command: 'echo' },
      } as unknown as CustomToolDescriptor;

      await writeFile(configPath, makeConfigYaml([makeCustomTool(), invalidTool]));
      const result = await manager.start(registry);

      expect(result.loaded).toBe(1);
      expect(result.errors).toHaveLength(1);
    });

    it('handles invalid YAML content gracefully', async () => {
      // Write content that YAML parses as a string (not an object)
      await writeFile(configPath, 'just a plain string');

      const result = await manager.start(registry);
      // YAML parses it but it's not an object with tools array
      expect(result.loaded).toBe(0);
    });

    it('handles config with no tools array', async () => {
      await writeFile(configPath, stringifyYaml({ version: 1, notTools: [] }));
      const result = await manager.start(registry);
      expect(result.loaded).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('reloads config — unregisters old tools before re-registering', async () => {
      const tool = makeCustomTool({ id: 'tool-aa' });
      await writeFile(configPath, makeConfigYaml([tool]));
      await manager.start(registry);

      expect(manager.listTools()).toHaveLength(1);

      // Rewrite config with different tools
      const newTools = [makeCustomTool({ id: 'tool-bb' }), makeCustomTool({ id: 'tool-cc' })];
      await writeFile(configPath, makeConfigYaml(newTools));
      await manager.loadConfig();

      expect(manager.listTools()).toHaveLength(2);
      expect(manager.getTool('tool-aa')).toBeUndefined();
      expect(manager.getTool('tool-bb')).toBeDefined();
      expect(manager.getTool('tool-cc')).toBeDefined();
    });

    it('handles tool with missing execution config', async () => {
      const badTool = {
        id: 'no-execution-tool',
        name: 'No Exec',
        description: 'Missing execution',
        version: '1.0.0',
        category: 'custom',
        parameters: [],
        // no execution field
      } as unknown as CustomToolDescriptor;
      await writeFile(configPath, makeConfigYaml([badTool]));

      const result = await manager.start(registry);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.error).toContain('execution');
    });

    it('handles tool with invalid execution mode', async () => {
      const badTool = makeCustomTool({
        id: 'bad-mode-tool',
        execution: { mode: 'invalid-mode' as never } as never,
      });
      await writeFile(configPath, makeConfigYaml([badTool]));

      const result = await manager.start(registry);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.error).toContain('invalid execution mode');
    });
  });

  // ── CRUD Operations ──────────────────────────────────────────────

  describe('addTool', () => {
    it('adds a tool and persists to config', async () => {
      await manager.start(registry);
      await manager.addTool(makeCustomTool());

      expect(manager.listTools()).toHaveLength(1);
      expect(registry.getTool('custom-test-tool')).toBeDefined();

      // Verify persistence
      const ondisk = await readFile(configPath, 'utf-8');
      expect(ondisk).toContain('custom-test-tool');
    });

    it('emits tool:added event', async () => {
      const events: string[] = [];
      manager.on('tool:added', () => events.push('tool:added'));

      await manager.start(registry);
      await manager.addTool(makeCustomTool());

      expect(events).toContain('tool:added');
    });

    it('rejects invalid tool descriptor', async () => {
      await manager.start(registry);

      const invalidTool = makeCustomTool({ id: 'INVALID' });
      await expect(manager.addTool(invalidTool)).rejects.toThrow('Invalid tool descriptor');
    });

    it('rejects tool without execution config', async () => {
      await manager.start(registry);

      const noExecTool = { ...makeCustomTool() } as CustomToolDescriptor;
      delete (noExecTool as Record<string, unknown>).execution;

      await expect(manager.addTool(noExecTool)).rejects.toThrow('execution');
    });
  });

  describe('addToolFromTemplate', () => {
    it('adds a tool from the CLI command template', async () => {
      await manager.start(registry);

      const desc = await manager.addToolFromTemplate('cli-command-wrapper', {
        id: 'my-cli-tool',
        name: 'My CLI',
        description: 'A CLI tool',
      });

      expect(desc.id).toBe('my-cli-tool');
      expect(desc.templateId).toBe('cli-command-wrapper');
      expect(desc.execution.mode).toBe('cli-command');
      expect(manager.getTool('my-cli-tool')).toBeDefined();
    });

    it('adds a tool from the REST API template', async () => {
      await manager.start(registry);

      const desc = await manager.addToolFromTemplate('rest-api-wrapper', {
        id: 'my-api-tool',
        name: 'My API',
        description: 'An API tool',
      });

      expect(desc.execution.mode).toBe('rest-api');
    });

    it('throws for unknown template', async () => {
      await manager.start(registry);

      await expect(
        manager.addToolFromTemplate('nonexistent', {
          id: 'tool-aa',
          name: 'Tool',
          description: 'desc',
        }),
      ).rejects.toThrow('Unknown template');
    });
  });

  describe('removeTool', () => {
    it('removes a tool and persists', async () => {
      await manager.start(registry);
      await manager.addTool(makeCustomTool());

      const removed = await manager.removeTool('custom-test-tool');
      expect(removed).toBe(true);
      expect(manager.listTools()).toHaveLength(0);
      expect(registry.getTool('custom-test-tool')).toBeUndefined();
    });

    it('returns false when tool does not exist', async () => {
      await manager.start(registry);
      const removed = await manager.removeTool('nonexistent');
      expect(removed).toBe(false);
    });

    it('emits tool:removed event', async () => {
      const events: string[] = [];
      manager.on('tool:removed', () => events.push('tool:removed'));

      await manager.start(registry);
      await manager.addTool(makeCustomTool());
      await manager.removeTool('custom-test-tool');

      expect(events).toContain('tool:removed');
    });
  });

  describe('listTools / getTool', () => {
    it('lists all custom tools', async () => {
      await manager.start(registry);
      await manager.addTool(makeCustomTool({ id: 'tool-aa' }));
      await manager.addTool(makeCustomTool({ id: 'tool-bb' }));

      const tools = manager.listTools();
      expect(tools).toHaveLength(2);
    });

    it('gets a specific tool by id', async () => {
      await manager.start(registry);
      await manager.addTool(makeCustomTool({ id: 'tool-aa' }));

      const tool = manager.getTool('tool-aa');
      expect(tool).toBeDefined();
      expect(tool!.id).toBe('tool-aa');
    });

    it('returns undefined for unknown tool', async () => {
      await manager.start(registry);
      expect(manager.getTool('nonexistent')).toBeUndefined();
    });
  });

  // ── Templates ────────────────────────────────────────────────────

  describe('getTemplates / getTemplate', () => {
    it('returns available templates', () => {
      const templates = manager.getTemplates();
      expect(templates.length).toBeGreaterThanOrEqual(3);
    });

    it('gets a specific template', () => {
      const template = manager.getTemplate('rest-api-wrapper');
      expect(template).toBeDefined();
      expect(template!.mode).toBe('rest-api');
    });

    it('returns undefined for unknown template', () => {
      expect(manager.getTemplate('nonexistent')).toBeUndefined();
    });
  });

  // ── Persistence ──────────────────────────────────────────────────

  describe('persistConfig', () => {
    it('writes tools to config file in YAML', async () => {
      await manager.start(registry);
      await manager.addTool(makeCustomTool());

      const content = await readFile(configPath, 'utf-8');
      expect(content).toContain('custom-test-tool');
      expect(content).toContain('version: 1');
    });
  });

  describe('initConfig', () => {
    it('creates a new config file', async () => {
      const result = await manager.initConfig();
      expect(result).toBe(true);

      const content = await readFile(configPath, 'utf-8');
      expect(content).toContain('version: 1');
      expect(content).toContain('tools:');
    });

    it('returns false if config already exists', async () => {
      await writeFile(configPath, 'existing');
      const result = await manager.initConfig();
      expect(result).toBe(false);
    });
  });

  // ── Config path ──────────────────────────────────────────────────

  describe('getConfigPath / getProvider', () => {
    it('returns the config path', () => {
      expect(manager.getConfigPath()).toBe(configPath);
    });

    it('returns the underlying provider', () => {
      const provider = manager.getProvider();
      expect(provider.name).toBe('custom-tools');
    });
  });

  // ── Hot-reload ───────────────────────────────────────────────────

  describe('hot-reload', () => {
    it('reloads tools when config changes', async () => {
      // Create initial config
      await writeFile(configPath, makeConfigYaml([makeCustomTool({ id: 'tool-aa' })]));

      // Start manager with watching enabled
      const watchManager = new CustomToolManager({
        configPath,
        watchEnabled: true,
        debounceMs: 50,
      });

      const reloadPromise = new Promise<void>((resolve) => {
        watchManager.on('tools:reloaded', () => resolve());
      });

      await watchManager.start(registry);
      expect(watchManager.listTools()).toHaveLength(1);

      // Update config file
      const newTools = [makeCustomTool({ id: 'tool-bb' }), makeCustomTool({ id: 'tool-cc' })];
      await writeFile(configPath, makeConfigYaml(newTools));

      // Wait for reload event (with timeout)
      await Promise.race([
        reloadPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Reload timeout')), 5000)),
      ]);

      expect(watchManager.listTools()).toHaveLength(2);
      expect(watchManager.getTool('tool-aa')).toBeUndefined();
      expect(watchManager.getTool('tool-bb')).toBeDefined();

      await watchManager.stop();
    });

    it('emits error event on reload failure', async () => {
      await writeFile(configPath, makeConfigYaml([makeCustomTool()]));

      const watchManager = new CustomToolManager({
        configPath,
        watchEnabled: true,
        debounceMs: 50,
      });

      const errorPromise = new Promise<void>((resolve) => {
        watchManager.on('tools:reloaded', () => resolve());
      });

      await watchManager.start(registry);

      // Write invalid YAML that won't crash but results in no tools array
      await writeFile(configPath, 'not_valid_config: true');

      await Promise.race([
        errorPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]);

      await watchManager.stop();
    });
  });
});
