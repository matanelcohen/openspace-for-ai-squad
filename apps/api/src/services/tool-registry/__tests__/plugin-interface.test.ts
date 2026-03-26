import { describe, expect, it } from 'vitest';

import { BaseToolProvider } from '../plugin-interface.js';
import type { ToolDescriptor } from '../types.js';

class TestProvider extends BaseToolProvider {
  readonly name = 'test-provider';

  constructor(tools: ToolDescriptor[] = []) {
    super();
    this.tools = tools;
  }

  async execute(_toolId: string, _params: Record<string, unknown>): Promise<unknown> {
    return { executed: true };
  }
}

function makeDescriptor(id: string): ToolDescriptor {
  return {
    id,
    name: `Tool ${id}`,
    description: 'A test tool',
    version: '1.0.0',
    category: 'custom',
    parameters: [],
  };
}

describe('BaseToolProvider', () => {
  it('returns tools set in constructor', () => {
    const tools = [makeDescriptor('tool-aa'), makeDescriptor('tool-bb')];
    const provider = new TestProvider(tools);

    expect(provider.getTools()).toHaveLength(2);
    expect(provider.getTools()).toEqual(tools);
  });

  it('returns empty array when no tools provided', () => {
    const provider = new TestProvider();
    expect(provider.getTools()).toEqual([]);
  });

  describe('getDescriptorOrThrow', () => {
    it('returns the descriptor for an owned tool', () => {
      const tools = [makeDescriptor('tool-aa')];
      const provider = new TestProvider(tools);
      // Access protected method via execute that calls it
      // Actually, getDescriptorOrThrow is protected, we need to test via a subclass
      const descriptor = (
        provider as unknown as { getDescriptorOrThrow: (id: string) => ToolDescriptor }
      ).getDescriptorOrThrow('tool-aa');
      expect(descriptor.id).toBe('tool-aa');
    });

    it('throws for unknown tool id', () => {
      const provider = new TestProvider([]);
      const fn = () =>
        (
          provider as unknown as { getDescriptorOrThrow: (id: string) => ToolDescriptor }
        ).getDescriptorOrThrow('unknown');
      expect(fn).toThrow('does not own tool');
      expect(fn).toThrow('test-provider');
    });
  });

  describe('lifecycle hooks', () => {
    it('initialize resolves by default', async () => {
      const provider = new TestProvider();
      await expect(provider.initialize()).resolves.toBeUndefined();
    });

    it('shutdown resolves by default', async () => {
      const provider = new TestProvider();
      await expect(provider.shutdown()).resolves.toBeUndefined();
    });
  });

  it('has the correct provider name', () => {
    const provider = new TestProvider();
    expect(provider.name).toBe('test-provider');
  });
});
