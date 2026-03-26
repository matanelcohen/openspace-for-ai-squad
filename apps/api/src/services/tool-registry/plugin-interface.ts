/**
 * Plugin interface for custom tool providers.
 *
 * Implement ToolProvider to register a set of tools with the registry.
 * Providers are responsible for declaring their tool descriptors and
 * handling execution.
 */

import type { ToolDescriptor, ToolProvider } from './types.js';

/**
 * Base class for tool providers. Provides sensible defaults.
 * Extend this or implement ToolProvider directly.
 */
export abstract class BaseToolProvider implements ToolProvider {
  abstract readonly name: string;

  protected tools: ToolDescriptor[] = [];

  getTools(): ToolDescriptor[] {
    return this.tools;
  }

  abstract execute(toolId: string, params: Record<string, unknown>): Promise<unknown>;

  async initialize(): Promise<void> {
    // Override in subclasses if needed
  }

  async shutdown(): Promise<void> {
    // Override in subclasses if needed
  }

  /** Helper: find a descriptor by id (throws if missing). */
  protected getDescriptorOrThrow(toolId: string): ToolDescriptor {
    const tool = this.tools.find((t) => t.id === toolId);
    if (!tool) throw new Error(`Provider "${this.name}" does not own tool "${toolId}"`);
    return tool;
  }
}
