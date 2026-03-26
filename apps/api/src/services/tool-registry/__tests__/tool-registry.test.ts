import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BaseToolProvider } from '../plugin-interface.js';
import { ToolRegistry } from '../tool-registry.js';
import type { ToolDescriptor, ToolProvider } from '../types.js';

// ── Helpers ────────────────────────────────────────────────────────

function validDescriptor(overrides: Partial<ToolDescriptor> = {}): ToolDescriptor {
  return {
    id: 'test-tool',
    name: 'Test Tool',
    description: 'A test tool',
    version: '1.0.0',
    category: 'custom',
    parameters: [],
    ...overrides,
  };
}

class StubProvider extends BaseToolProvider {
  readonly name: string;
  private readonly handler: (toolId: string, params: Record<string, unknown>) => Promise<unknown>;

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
}

// ── Tests ──────────────────────────────────────────────────────────

describe('ToolRegistry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  afterEach(async () => {
    await registry.shutdown();
  });

  // ── register / unregister ──────────────────────────────────────

  describe('register', () => {
    it('registers a valid tool', () => {
      const desc = validDescriptor();
      const provider = new StubProvider('stub', [desc]);
      registry.register(desc, provider);

      expect(registry.size).toBe(1);
      expect(registry.getTool('test-tool')).toEqual(desc);
    });

    it('throws on invalid descriptor', () => {
      const desc = validDescriptor({ id: 'INVALID' });
      const provider = new StubProvider('stub', [desc]);

      expect(() => registry.register(desc, provider)).toThrow('Invalid tool descriptor');
    });

    it('throws on duplicate tool id', () => {
      const desc = validDescriptor();
      const provider = new StubProvider('stub', [desc]);
      registry.register(desc, provider);

      expect(() => registry.register(desc, provider)).toThrow('already registered');
    });

    it('reuses existing provider on second register', () => {
      const provider = new StubProvider('stub', []);
      registry.register(validDescriptor({ id: 'tool-aa' }), provider);
      registry.register(validDescriptor({ id: 'tool-bb' }), provider);

      expect(registry.getProviders()).toEqual(['stub']);
      expect(registry.size).toBe(2);
    });
  });

  describe('unregister', () => {
    it('removes a registered tool', () => {
      const desc = validDescriptor();
      const provider = new StubProvider('stub', [desc]);
      registry.register(desc, provider);

      const removed = registry.unregister('test-tool');
      expect(removed).toBe(true);
      expect(registry.size).toBe(0);
      expect(registry.getTool('test-tool')).toBeUndefined();
    });

    it('returns false for unknown tool', () => {
      expect(registry.unregister('nonexistent')).toBe(false);
    });
  });

  // ── registerProvider / unregisterProvider ──────────────────────

  describe('registerProvider', () => {
    it('registers a provider and all its tools', async () => {
      const tools = [validDescriptor({ id: 'tool-aa' }), validDescriptor({ id: 'tool-bb' })];
      const provider = new StubProvider('multi', tools);

      await registry.registerProvider(provider);

      expect(registry.size).toBe(2);
      expect(registry.getProviders()).toContain('multi');
    });

    it('calls provider.initialize on registration', async () => {
      const provider = new StubProvider('init', []);
      const initSpy = vi.spyOn(provider, 'initialize');

      await registry.registerProvider(provider);
      expect(initSpy).toHaveBeenCalledOnce();
    });

    it('throws on duplicate provider name', async () => {
      const provider = new StubProvider('dup', []);
      await registry.registerProvider(provider);

      await expect(registry.registerProvider(provider)).rejects.toThrow('already registered');
    });

    it('skips invalid tools but registers valid ones', async () => {
      const tools = [
        validDescriptor({ id: 'good-tool' }),
        validDescriptor({ id: 'INVALID' }), // bad id pattern
      ];
      const provider = new StubProvider('mixed', tools);

      await registry.registerProvider(provider);
      expect(registry.size).toBe(1);
      expect(registry.getTool('good-tool')).toBeDefined();
    });
  });

  describe('unregisterProvider', () => {
    it('removes a provider and all its tools', async () => {
      const tools = [validDescriptor({ id: 'tool-aa' }), validDescriptor({ id: 'tool-bb' })];
      const provider = new StubProvider('bye', tools);
      await registry.registerProvider(provider);

      const removed = await registry.unregisterProvider('bye');
      expect(removed).toBe(true);
      expect(registry.size).toBe(0);
      expect(registry.getProviders()).not.toContain('bye');
    });

    it('calls provider.shutdown', async () => {
      const provider = new StubProvider('shut', []);
      const shutdownSpy = vi.spyOn(provider, 'shutdown');
      await registry.registerProvider(provider);

      await registry.unregisterProvider('shut');
      expect(shutdownSpy).toHaveBeenCalledOnce();
    });

    it('returns false for unknown provider', async () => {
      expect(await registry.unregisterProvider('nope')).toBe(false);
    });
  });

  // ── discover ───────────────────────────────────────────────────

  describe('discover', () => {
    beforeEach(async () => {
      const tools = [
        validDescriptor({ id: 'git-status', name: 'Git Status', category: 'git' }),
        validDescriptor({ id: 'file-read', name: 'Read File', category: 'file' }),
        validDescriptor({ id: 'search-grep', name: 'Grep Search', category: 'search' }),
      ];
      const provider = new StubProvider('all', tools);
      await registry.registerProvider(provider);
    });

    it('returns all tools with no filter', () => {
      expect(registry.discover()).toHaveLength(3);
    });

    it('filters by category', () => {
      const results = registry.discover({ category: 'git' });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('git-status');
    });

    it('filters by name (case-insensitive substring)', () => {
      const results = registry.discover({ name: 'grep' });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe('search-grep');
    });

    it('filters by id', () => {
      const results = registry.discover({ id: 'file-read' });
      expect(results).toHaveLength(1);
    });

    it('returns empty for no matches', () => {
      expect(registry.discover({ category: 'api' })).toHaveLength(0);
    });

    it('combines filters', () => {
      const results = registry.discover({ category: 'git', name: 'status' });
      expect(results).toHaveLength(1);
    });
  });

  // ── invoke ─────────────────────────────────────────────────────

  describe('invoke', () => {
    it('invokes a tool and returns success result', async () => {
      const desc = validDescriptor({
        parameters: [{ name: 'msg', type: 'string', description: 'Message', required: true }],
      });
      const provider = new StubProvider('invoke-test', [desc], async (_id, params) => {
        return `Hello ${params.msg}`;
      });
      await registry.registerProvider(provider);

      const result = await registry.invoke({
        toolId: 'test-tool',
        parameters: { msg: 'world' },
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe('Hello world');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns TOOL_NOT_FOUND for unknown tool', async () => {
      const result = await registry.invoke({ toolId: 'nope', parameters: {} });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_NOT_FOUND');
    });

    it('returns VALIDATION_ERROR for bad parameters', async () => {
      const desc = validDescriptor({
        parameters: [{ name: 'x', type: 'number', description: 'A number', required: true }],
      });
      const provider = new StubProvider('val-test', [desc]);
      await registry.registerProvider(provider);

      const result = await registry.invoke({
        toolId: 'test-tool',
        parameters: { x: 'not a number' },
      });

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('VALIDATION_ERROR');
    });

    it('returns EXECUTION_ERROR when handler throws', async () => {
      const desc = validDescriptor();
      const provider = new StubProvider('err-test', [desc], async () => {
        throw new Error('handler exploded');
      });
      await registry.registerProvider(provider);

      const result = await registry.invoke({ toolId: 'test-tool', parameters: {} });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXECUTION_ERROR');
      expect(result.error?.message).toContain('handler exploded');
    });

    it('returns TIMEOUT when handler exceeds timeout', async () => {
      const desc = validDescriptor({ timeout: 100 }); // schema minimum is 100
      const provider = new StubProvider('timeout-test', [desc], async () => {
        await new Promise((r) => setTimeout(r, 5000));
      });
      await registry.registerProvider(provider);

      const result = await registry.invoke({ toolId: 'test-tool', parameters: {}, timeout: 100 });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });

    it('allows timeout override in ToolInput', async () => {
      const desc = validDescriptor({ timeout: 30_000 }); // long default
      const provider = new StubProvider('timeout-override', [desc], async () => {
        await new Promise((r) => setTimeout(r, 5000));
      });
      await registry.registerProvider(provider);

      const result = await registry.invoke({
        toolId: 'test-tool',
        parameters: {},
        timeout: 50,
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });
  });

  // ── events ─────────────────────────────────────────────────────

  describe('events', () => {
    it('emits tool:registered on register', () => {
      const events: string[] = [];
      registry.on((e) => events.push(e.type));

      const desc = validDescriptor();
      const provider = new StubProvider('evt', [desc]);
      registry.register(desc, provider);

      expect(events).toContain('tool:registered');
    });

    it('emits tool:unregistered on unregister', () => {
      const events: string[] = [];
      const desc = validDescriptor();
      const provider = new StubProvider('evt', [desc]);
      registry.register(desc, provider);

      registry.on((e) => events.push(e.type));
      registry.unregister('test-tool');

      expect(events).toContain('tool:unregistered');
    });

    it('emits tool:invoked on successful invoke', async () => {
      const events: string[] = [];
      const desc = validDescriptor();
      const provider = new StubProvider('evt', [desc]);
      await registry.registerProvider(provider);

      registry.on((e) => events.push(e.type));
      await registry.invoke({ toolId: 'test-tool', parameters: {} });

      expect(events).toContain('tool:invoked');
    });

    it('emits tool:error on failed invoke', async () => {
      const events: string[] = [];
      const desc = validDescriptor();
      const provider = new StubProvider('evt', [desc], async () => {
        throw new Error('fail');
      });
      await registry.registerProvider(provider);

      registry.on((e) => events.push(e.type));
      await registry.invoke({ toolId: 'test-tool', parameters: {} });

      expect(events).toContain('tool:error');
    });

    it('unsubscribe function works', () => {
      const events: string[] = [];
      const unsub = registry.on((e) => events.push(e.type));

      const desc = validDescriptor();
      const provider = new StubProvider('evt', [desc]);
      registry.register(desc, provider);
      expect(events).toHaveLength(1);

      unsub();
      registry.unregister('test-tool');
      // Should still be 1 — no new events after unsub
      expect(events).toHaveLength(1);
    });

    it('listener errors do not break the registry', () => {
      registry.on(() => {
        throw new Error('listener boom');
      });

      const desc = validDescriptor();
      const provider = new StubProvider('evt', [desc]);
      // Should not throw
      expect(() => registry.register(desc, provider)).not.toThrow();
      expect(registry.size).toBe(1);
    });
  });

  // ── loadFromFile ───────────────────────────────────────────────

  describe('loadFromFile', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'registry-load-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('loads tools from a JSON config file', async () => {
      const config = {
        tools: [
          validDescriptor({ id: 'loaded-tool' }),
        ],
      };
      const file = join(tmpDir, 'tools.json');
      await writeFile(file, JSON.stringify(config));

      const provider = new StubProvider('file-loader', [validDescriptor({ id: 'loaded-tool' })]);
      const result = await registry.loadFromFile(file, provider);

      expect(result.loaded).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(registry.getTool('loaded-tool')).toBeDefined();
    });

    it('does not duplicate already-registered tools', async () => {
      const desc = validDescriptor({ id: 'already-here' });
      const provider = new StubProvider('file-loader', [desc]);
      registry.register(desc, provider);

      const config = { tools: [validDescriptor({ id: 'already-here' })] };
      const file = join(tmpDir, 'tools.json');
      await writeFile(file, JSON.stringify(config));

      await registry.loadFromFile(file, provider);
      expect(registry.size).toBe(1);
    });
  });

  // ── shutdown ───────────────────────────────────────────────────

  describe('shutdown', () => {
    it('clears all tools, providers, and listeners', async () => {
      const desc = validDescriptor();
      const provider = new StubProvider('shut', [desc]);
      await registry.registerProvider(provider);
      registry.on(() => {});

      await registry.shutdown();

      expect(registry.size).toBe(0);
      expect(registry.getProviders()).toHaveLength(0);
    });

    it('calls shutdown on all providers', async () => {
      const provider = new StubProvider('shut', []);
      const spy = vi.spyOn(provider, 'shutdown');
      await registry.registerProvider(provider);

      await registry.shutdown();
      expect(spy).toHaveBeenCalledOnce();
    });
  });
});
