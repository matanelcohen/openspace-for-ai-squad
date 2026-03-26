/**
 * Edge-case tests for the tool registry.
 *
 * Tests: invalid schemas, boundary values, concurrent access,
 * missing tools/providers, large registries, timeout races, listener edge cases.
 */

import { describe, expect, it, vi } from 'vitest';

import { BaseToolProvider } from '../plugin-interface.js';
import { buildInputSchema } from '../schemas.js';
import { ToolExecutor } from '../tool-executor.js';
import { ToolRegistry } from '../tool-registry.js';
import { ToolValidator } from '../tool-validator.js';
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

describe('Edge Cases', () => {
  // ── Schema boundary values ────────────────────────────────────

  describe('schema boundary values', () => {
    const validator = new ToolValidator();

    it('rejects id with only 2 characters (below min length)', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ id: 'ab' }));
      expect(result.valid).toBe(false);
    });

    it('accepts id with exactly 3 characters (min valid length)', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ id: 'abc' }));
      expect(result.valid).toBe(true);
    });

    it('rejects id starting with a number', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ id: '1abc' }));
      expect(result.valid).toBe(false);
    });

    it('rejects id ending with a hyphen', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ id: 'abc-' }));
      expect(result.valid).toBe(false);
    });

    it('rejects id with uppercase letters', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ id: 'aBc' }));
      expect(result.valid).toBe(false);
    });

    it('rejects id with spaces', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ id: 'a b c' }));
      expect(result.valid).toBe(false);
    });

    it('rejects id with special characters', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ id: 'abc.def' }));
      expect(result.valid).toBe(false);
    });

    it('accepts long id at max pattern length (64 chars)', () => {
      const longId = 'a' + 'b'.repeat(62) + 'c';
      expect(longId.length).toBe(64);
      const result = validator.validateToolDescriptor(validDescriptor({ id: longId }));
      expect(result.valid).toBe(true);
    });

    it('rejects id over 64 characters', () => {
      const tooLong = 'a' + 'b'.repeat(63) + 'c';
      expect(tooLong.length).toBe(65);
      const result = validator.validateToolDescriptor(validDescriptor({ id: tooLong }));
      expect(result.valid).toBe(false);
    });

    it('rejects empty name', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ name: '' }));
      expect(result.valid).toBe(false);
    });

    it('rejects empty description', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ description: '' }));
      expect(result.valid).toBe(false);
    });

    it('accepts timeout at minimum (100)', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ timeout: 100 }));
      expect(result.valid).toBe(true);
    });

    it('rejects timeout at 99 (below minimum)', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ timeout: 99 }));
      expect(result.valid).toBe(false);
    });

    it('accepts timeout at maximum (300000)', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ timeout: 300_000 }));
      expect(result.valid).toBe(true);
    });

    it('rejects timeout above maximum', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ timeout: 300_001 }));
      expect(result.valid).toBe(false);
    });

    it('accepts retries at 0 (minimum)', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ retries: 0 }));
      expect(result.valid).toBe(true);
    });

    it('accepts retries at 5 (maximum)', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ retries: 5 }));
      expect(result.valid).toBe(true);
    });

    it('rejects retries at 6 (above maximum)', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ retries: 6 }));
      expect(result.valid).toBe(false);
    });

    it('rejects fractional retries', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ retries: 2.5 }));
      expect(result.valid).toBe(false);
    });

    it('accepts version with multi-digit segments', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ version: '12.345.6789' }));
      expect(result.valid).toBe(true);
    });

    it('rejects version with v prefix', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ version: 'v1.0.0' }));
      expect(result.valid).toBe(false);
    });

    it('rejects version with only two segments', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ version: '1.0' }));
      expect(result.valid).toBe(false);
    });

    it('rejects version with four segments', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ version: '1.0.0.0' }));
      expect(result.valid).toBe(false);
    });

    it('accepts metadata as an object', () => {
      const result = validator.validateToolDescriptor(
        validDescriptor({ metadata: { author: 'test', tags: ['a', 'b'] } }),
      );
      expect(result.valid).toBe(true);
    });

    it('accepts parameter with enum', () => {
      const result = validator.validateToolDescriptor(
        validDescriptor({
          parameters: [
            {
              name: 'color',
              type: 'string',
              description: 'A color',
              enum: ['red', 'green', 'blue'],
            },
          ],
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('accepts parameter with items (array type)', () => {
      const result = validator.validateToolDescriptor(
        validDescriptor({
          parameters: [
            {
              name: 'tags',
              type: 'array',
              description: 'Tags',
              items: { type: 'string' },
            },
          ],
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('rejects parameter with invalid type', () => {
      const result = validator.validateToolDescriptor(
        validDescriptor({
          parameters: [{ name: 'x', type: 'date' as never, description: 'A date' }],
        }),
      );
      expect(result.valid).toBe(false);
    });

    it('rejects parameter with empty name', () => {
      const result = validator.validateToolDescriptor(
        validDescriptor({
          parameters: [{ name: '', type: 'string', description: 'empty name' }],
        }),
      );
      expect(result.valid).toBe(false);
    });

    it('rejects parameter with empty description', () => {
      const result = validator.validateToolDescriptor(
        validDescriptor({
          parameters: [{ name: 'x', type: 'string', description: '' }],
        }),
      );
      expect(result.valid).toBe(false);
    });
  });

  // ── buildInputSchema edge cases ──────────────────────────────

  describe('buildInputSchema', () => {
    it('builds schema with enum constraints', () => {
      const descriptor = validDescriptor({
        parameters: [
          {
            name: 'color',
            type: 'string',
            description: 'Color',
            enum: ['red', 'blue'],
            required: true,
          },
        ],
      });
      const schema = buildInputSchema(descriptor);
      expect((schema as Record<string, unknown>).required).toEqual(['color']);
      const props = (schema as Record<string, Record<string, unknown>>).properties;
      expect((props.color as Record<string, unknown>).enum).toEqual(['red', 'blue']);
    });

    it('builds schema with array items', () => {
      const descriptor = validDescriptor({
        parameters: [
          { name: 'items', type: 'array', description: 'Items', items: { type: 'string' } },
        ],
      });
      const schema = buildInputSchema(descriptor);
      const props = (schema as Record<string, Record<string, unknown>>).properties;
      expect((props.items as Record<string, unknown>).items).toEqual({ type: 'string' });
    });

    it('builds schema with nested properties', () => {
      const descriptor = validDescriptor({
        parameters: [
          {
            name: 'config',
            type: 'object',
            description: 'Config',
            properties: {
              host: { type: 'string', description: 'Hostname' },
              port: { type: 'number', description: 'Port' },
            },
          },
        ],
      });
      const schema = buildInputSchema(descriptor);
      const props = (schema as Record<string, Record<string, unknown>>).properties;
      expect((props.config as Record<string, unknown>).properties).toBeDefined();
    });

    it('separates required and optional params', () => {
      const descriptor = validDescriptor({
        parameters: [
          { name: 'required-param', type: 'string', description: 'Required', required: true },
          { name: 'optional-param', type: 'string', description: 'Optional', required: false },
          { name: 'also-optional', type: 'string', description: 'Also optional' },
        ],
      });
      const schema = buildInputSchema(descriptor);
      expect((schema as Record<string, unknown>).required).toEqual(['required-param']);
    });
  });

  // ── Concurrent access ─────────────────────────────────────────

  describe('concurrent access', () => {
    it('handles concurrent tool invocations', async () => {
      const registry = new ToolRegistry();
      const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

      const provider = new StubProvider(
        'concurrent',
        [
          validDescriptor({
            id: 'slow-tool',
            parameters: [{ name: 'id', type: 'number', description: 'ID', required: true }],
          }),
        ],
        async (_toolId, params) => {
          await delay(10);
          return `result-${params.id}`;
        },
      );
      await registry.registerProvider(provider);

      // Fire 20 concurrent invocations
      const promises = Array.from({ length: 20 }, (_, i) =>
        registry.invoke({ toolId: 'slow-tool', parameters: { id: i } }),
      );

      const results = await Promise.all(promises);

      // All should succeed
      expect(results.every((r) => r.success)).toBe(true);
      // All should have unique results
      const data = results.map((r) => r.data);
      expect(new Set(data).size).toBe(20);

      await registry.shutdown();
    });

    it('handles concurrent register and invoke', async () => {
      const registry = new ToolRegistry();
      const provider = new StubProvider(
        'conc-reg',
        [validDescriptor({ id: 'conc-tool' })],
        async () => 'ok',
      );
      await registry.registerProvider(provider);

      // Register new tools while invoking existing ones
      const promises: Promise<unknown>[] = [];

      for (let i = 0; i < 10; i++) {
        promises.push(registry.invoke({ toolId: 'conc-tool', parameters: {} }));
        const newDesc = validDescriptor({ id: `new-tool-${String(i).padStart(2, '0')}` });
        promises.push(Promise.resolve(registry.register(newDesc, provider)));
      }

      await Promise.allSettled(promises);
      expect(registry.size).toBeGreaterThanOrEqual(11); // 1 original + 10 new

      await registry.shutdown();
    });

    it('handles concurrent register and unregister', async () => {
      const registry = new ToolRegistry();
      const provider = new StubProvider('conc', []);

      // Register 20 tools
      for (let i = 0; i < 20; i++) {
        registry.register(validDescriptor({ id: `tool-${String(i).padStart(3, '0')}` }), provider);
      }
      expect(registry.size).toBe(20);

      // Concurrently unregister half and register new ones
      const promises: Promise<unknown>[] = [];
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve(registry.unregister(`tool-${String(i).padStart(3, '0')}`)));
        promises.push(
          Promise.resolve(
            registry.register(
              validDescriptor({ id: `new-tool-${String(i).padStart(3, '0')}` }),
              provider,
            ),
          ),
        );
      }

      await Promise.allSettled(promises);
      // 20 - 10 + 10 = 20
      expect(registry.size).toBe(20);

      await registry.shutdown();
    });
  });

  // ── Missing tools / providers ────────────────────────────────

  describe('missing tools and providers', () => {
    it('returns TOOL_NOT_FOUND for invoking nonexistent tool', async () => {
      const registry = new ToolRegistry();
      const result = await registry.invoke({
        toolId: 'does-not-exist',
        parameters: {},
      });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TOOL_NOT_FOUND');
      await registry.shutdown();
    });

    it('getTool returns undefined for nonexistent id', () => {
      const registry = new ToolRegistry();
      expect(registry.getTool('nope')).toBeUndefined();
    });

    it('handles provider that returns no tools', async () => {
      const registry = new ToolRegistry();
      const emptyProvider = new StubProvider('empty', []);
      await registry.registerProvider(emptyProvider);

      expect(registry.size).toBe(0);
      expect(registry.getProviders()).toContain('empty');

      await registry.shutdown();
    });

    it('discover returns empty array on empty registry', () => {
      const registry = new ToolRegistry();
      expect(registry.discover()).toEqual([]);
      expect(registry.discover({ category: 'git' })).toEqual([]);
    });
  });

  // ── Large registry ────────────────────────────────────────────

  describe('large registry', () => {
    it('handles 500 tools across multiple providers', async () => {
      const registry = new ToolRegistry();

      for (let p = 0; p < 5; p++) {
        const tools: ToolDescriptor[] = [];
        for (let t = 0; t < 100; t++) {
          tools.push(
            validDescriptor({
              id: `p${p}-tool-${String(t).padStart(3, '0')}`,
              name: `Tool ${p}-${t}`,
            }),
          );
        }
        const provider = new StubProvider(`provider-${p}`, tools);
        await registry.registerProvider(provider);
      }

      expect(registry.size).toBe(500);
      expect(registry.getProviders()).toHaveLength(5);

      // Discover still works
      const all = registry.discover();
      expect(all).toHaveLength(500);

      // Filter works with large set
      const filtered = registry.discover({ name: 'Tool 2-50' });
      expect(filtered.length).toBeGreaterThanOrEqual(1);

      await registry.shutdown();
      expect(registry.size).toBe(0);
    });
  });

  // ── Timeout races ─────────────────────────────────────────────

  describe('timeout races', () => {
    it('handler resolves just before timeout', async () => {
      const executor = new ToolExecutor();
      const handler = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve('just in time'), 30)),
        );

      const result = await executor.execute(
        validDescriptor(),
        {},
        handler,
        200, // generous timeout
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe('just in time');
    });

    it('handler rejects before timeout — gets error not timeout', async () => {
      const executor = new ToolExecutor();
      const handler = vi
        .fn()
        .mockImplementation(
          () => new Promise((_, reject) => setTimeout(() => reject(new Error('fast fail')), 10)),
        );

      const result = await executor.execute(validDescriptor(), {}, handler, 5000);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXECUTION_ERROR');
      expect(result.error?.message).toContain('fast fail');
    });

    it('very short timeout (100ms minimum) still works', async () => {
      const executor = new ToolExecutor();
      const handler = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 500)));

      const result = await executor.execute(validDescriptor(), {}, handler, 100);
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });
  });

  // ── Listener edge cases ──────────────────────────────────────

  describe('listener edge cases', () => {
    it('multiple listeners all receive events', () => {
      const registry = new ToolRegistry();
      const events1: string[] = [];
      const events2: string[] = [];
      const events3: string[] = [];

      registry.on((e) => events1.push(e.type));
      registry.on((e) => events2.push(e.type));
      registry.on((e) => events3.push(e.type));

      const provider = new StubProvider('evt', []);
      registry.register(validDescriptor(), provider);

      expect(events1).toEqual(['tool:registered']);
      expect(events2).toEqual(['tool:registered']);
      expect(events3).toEqual(['tool:registered']);
    });

    it('throwing listener does not prevent other listeners from receiving events', () => {
      const registry = new ToolRegistry();
      const events: string[] = [];

      registry.on(() => {
        throw new Error('listener 1 explodes');
      });
      registry.on((e) => events.push(e.type));
      registry.on(() => {
        throw new Error('listener 3 explodes');
      });

      const provider = new StubProvider('evt', []);
      registry.register(validDescriptor(), provider);

      // Listener 2 still got the event
      expect(events).toEqual(['tool:registered']);
    });

    it('unsubscribing one listener does not affect others', () => {
      const registry = new ToolRegistry();
      const events1: string[] = [];
      const events2: string[] = [];

      const unsub1 = registry.on((e) => events1.push(e.type));
      registry.on((e) => events2.push(e.type));

      const provider = new StubProvider('evt', []);
      registry.register(validDescriptor({ id: 'tool-aa' }), provider);

      unsub1();
      registry.register(validDescriptor({ id: 'tool-bb' }), provider);

      expect(events1).toHaveLength(1); // only got first event
      expect(events2).toHaveLength(2); // got both events
    });

    it('unsubscribing same listener twice is harmless', () => {
      const registry = new ToolRegistry();
      const events: string[] = [];

      const unsub = registry.on((e) => events.push(e.type));
      unsub();
      unsub(); // should not throw

      const provider = new StubProvider('evt', []);
      expect(() => registry.register(validDescriptor(), provider)).not.toThrow();
    });
  });

  // ── Input validation edge cases ──────────────────────────────

  describe('input validation edge cases', () => {
    it('accepts empty params for tool with no required params', () => {
      const validator = new ToolValidator();
      const desc = validDescriptor({
        id: 'opt-param-tool',
        parameters: [{ name: 'optional', type: 'string', description: 'Optional param' }],
      });
      const result = validator.validateInput(desc, {});
      expect(result.valid).toBe(true);
    });

    it('rejects extra properties in strict mode', () => {
      const validator = new ToolValidator();
      const desc = validDescriptor({
        id: 'strict-prop-tool',
        parameters: [{ name: 'expected', type: 'string', description: 'Expected', required: true }],
      });
      const result = validator.validateInput(desc, {
        expected: 'ok',
        unexpected: 'not allowed',
      });
      expect(result.valid).toBe(false);
    });

    it('validates boolean parameter type strictly', () => {
      const validator = new ToolValidator();
      const desc = validDescriptor({
        id: 'bool-tool',
        parameters: [{ name: 'flag', type: 'boolean', description: 'A flag', required: true }],
      });

      expect(validator.validateInput(desc, { flag: true }).valid).toBe(true);
      expect(validator.validateInput(desc, { flag: false }).valid).toBe(true);
      expect(validator.validateInput(desc, { flag: 'true' }).valid).toBe(false);
      expect(validator.validateInput(desc, { flag: 1 }).valid).toBe(false);
    });

    it('validates number parameter type strictly', () => {
      const validator = new ToolValidator();
      const desc = validDescriptor({
        id: 'num-tool',
        parameters: [{ name: 'count', type: 'number', description: 'Count', required: true }],
      });

      expect(validator.validateInput(desc, { count: 42 }).valid).toBe(true);
      expect(validator.validateInput(desc, { count: 3.14 }).valid).toBe(true);
      expect(validator.validateInput(desc, { count: '42' }).valid).toBe(false);
    });

    it('rejects null for required parameter', () => {
      const validator = new ToolValidator();
      const desc = validDescriptor({
        id: 'null-tool',
        parameters: [{ name: 'x', type: 'string', description: 'Required', required: true }],
      });
      const result = validator.validateInput(desc, { x: null });
      expect(result.valid).toBe(false);
    });
  });

  // ── PROVIDER_ERROR path ──────────────────────────────────────

  describe('PROVIDER_ERROR path', () => {
    it('returns PROVIDER_ERROR when tool exists but provider is missing', async () => {
      const registry = new ToolRegistry();
      const desc = validDescriptor();
      const provider = new StubProvider('tmp', [desc]);
      registry.register(desc, provider);

      // Manually corrupt internal state by removing the provider
      // This simulates a race condition where provider is removed mid-invocation
      const providers = (registry as unknown as { providers: Map<string, ToolProvider> }).providers;
      providers.delete('tmp');

      const result = await registry.invoke({ toolId: 'test-tool', parameters: {} });
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PROVIDER_ERROR');

      await registry.shutdown();
    });
  });
});
