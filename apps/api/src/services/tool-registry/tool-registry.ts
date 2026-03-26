/**
 * Core Tool Registry — central service for tool management.
 *
 * Provides register/unregister/discover/invoke operations with
 * schema validation, plugin support, and event notifications.
 */

import { ToolExecutor } from './tool-executor.js';
import { ToolLoader } from './tool-loader.js';
import { ToolValidator } from './tool-validator.js';
import type {
  RegistryEvent,
  RegistryEventListener,
  ToolDescriptor,
  ToolFilter,
  ToolInput,
  ToolProvider,
  ToolResult,
} from './types.js';

export class ToolRegistry {
  private readonly tools = new Map<string, ToolDescriptor>();
  private readonly providers = new Map<string, ToolProvider>();
  private readonly toolToProvider = new Map<string, string>();
  private readonly listeners: RegistryEventListener[] = [];

  private readonly validator = new ToolValidator();
  private readonly executor = new ToolExecutor();
  private readonly loader = new ToolLoader();

  // ── Registration ──────────────────────────────────────────────

  /**
   * Register a single tool descriptor with an execution handler.
   */
  register(descriptor: ToolDescriptor, provider: ToolProvider): void {
    const validation = this.validator.validateToolDescriptor(descriptor);
    if (!validation.valid) {
      throw new Error(
        `Invalid tool descriptor for "${descriptor.id ?? '(unknown)'}": ${validation.errors?.message}`,
      );
    }

    if (this.tools.has(descriptor.id)) {
      throw new Error(`Tool "${descriptor.id}" is already registered`);
    }

    this.tools.set(descriptor.id, descriptor);
    this.toolToProvider.set(descriptor.id, provider.name);

    if (!this.providers.has(provider.name)) {
      this.providers.set(provider.name, provider);
    }

    this.emit({ type: 'tool:registered', toolId: descriptor.id, timestamp: Date.now() });
  }

  /**
   * Register a ToolProvider (plugin) and all its tools.
   */
  async registerProvider(provider: ToolProvider): Promise<void> {
    if (this.providers.has(provider.name)) {
      throw new Error(`Provider "${provider.name}" is already registered`);
    }

    if (provider.initialize) {
      await provider.initialize();
    }

    this.providers.set(provider.name, provider);

    for (const tool of provider.getTools()) {
      const validation = this.validator.validateToolDescriptor(tool);
      if (!validation.valid) {
        console.warn(`Skipping invalid tool "${tool.id}" from provider "${provider.name}"`);
        continue;
      }
      this.tools.set(tool.id, tool);
      this.toolToProvider.set(tool.id, provider.name);
      this.emit({ type: 'tool:registered', toolId: tool.id, timestamp: Date.now() });
    }
  }

  /**
   * Unregister a tool by id.
   */
  unregister(toolId: string): boolean {
    const existed = this.tools.delete(toolId);
    if (existed) {
      this.toolToProvider.delete(toolId);
      this.validator.clearCache(toolId);
      this.emit({ type: 'tool:unregistered', toolId, timestamp: Date.now() });
    }
    return existed;
  }

  /**
   * Unregister a provider and all its tools.
   */
  async unregisterProvider(providerName: string): Promise<boolean> {
    const provider = this.providers.get(providerName);
    if (!provider) return false;

    for (const tool of provider.getTools()) {
      this.tools.delete(tool.id);
      this.toolToProvider.delete(tool.id);
      this.validator.clearCache(tool.id);
      this.emit({ type: 'tool:unregistered', toolId: tool.id, timestamp: Date.now() });
    }

    if (provider.shutdown) {
      await provider.shutdown();
    }

    this.providers.delete(providerName);
    return true;
  }

  // ── Discovery ─────────────────────────────────────────────────

  /**
   * Discover tools matching optional filters.
   */
  discover(filter?: ToolFilter): ToolDescriptor[] {
    let results = [...this.tools.values()];

    if (filter?.category) {
      results = results.filter((t) => t.category === filter.category);
    }
    if (filter?.name) {
      const q = filter.name.toLowerCase();
      results = results.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (filter?.id) {
      results = results.filter((t) => t.id === filter.id);
    }

    return results;
  }

  /**
   * Get a single tool descriptor by id.
   */
  getTool(toolId: string): ToolDescriptor | undefined {
    return this.tools.get(toolId);
  }

  /**
   * Get all registered provider names.
   */
  getProviders(): string[] {
    return [...this.providers.keys()];
  }

  // ── Invocation ────────────────────────────────────────────────

  /**
   * Invoke a tool by id with parameters.
   */
  async invoke(input: ToolInput): Promise<ToolResult> {
    const descriptor = this.tools.get(input.toolId);
    if (!descriptor) {
      return {
        toolId: input.toolId,
        success: false,
        error: { code: 'TOOL_NOT_FOUND', message: `Tool "${input.toolId}" not found` },
        durationMs: 0,
      };
    }

    // Validate input params
    const validation = this.validator.validateInput(descriptor, input.parameters);
    if (!validation.valid) {
      return {
        toolId: input.toolId,
        success: false,
        error: validation.errors!,
        durationMs: 0,
      };
    }

    // Resolve provider
    const providerName = this.toolToProvider.get(input.toolId);
    const provider = providerName ? this.providers.get(providerName) : undefined;
    if (!provider) {
      return {
        toolId: input.toolId,
        success: false,
        error: { code: 'PROVIDER_ERROR', message: `No provider for tool "${input.toolId}"` },
        durationMs: 0,
      };
    }

    // Execute with timeout/error handling
    const result = await this.executor.execute(
      descriptor,
      input.parameters,
      (params) => provider.execute(input.toolId, params),
      input.timeout,
    );

    this.emit({
      type: result.success ? 'tool:invoked' : 'tool:error',
      toolId: input.toolId,
      timestamp: Date.now(),
      details: result.success ? { durationMs: result.durationMs } : result.error,
    });

    return result;
  }

  // ── Config loading ────────────────────────────────────────────

  /**
   * Load tools from a YAML/JSON config file and register them with a provider.
   */
  async loadFromFile(filePath: string, provider: ToolProvider): Promise<{
    loaded: number;
    errors: Array<{ index: number; error: string }>;
  }> {
    const { tools, errors } = await this.loader.loadFromFile(filePath);

    for (const tool of tools) {
      if (!this.tools.has(tool.id)) {
        this.tools.set(tool.id, tool);
        this.toolToProvider.set(tool.id, provider.name);
        if (!this.providers.has(provider.name)) {
          this.providers.set(provider.name, provider);
        }
        this.emit({ type: 'tool:registered', toolId: tool.id, timestamp: Date.now() });
      }
    }

    return { loaded: tools.length, errors };
  }

  // ── Events ────────────────────────────────────────────────────

  /**
   * Subscribe to registry events.
   */
  on(listener: RegistryEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  // ── Lifecycle ─────────────────────────────────────────────────

  /**
   * Shut down the registry and all providers.
   */
  async shutdown(): Promise<void> {
    for (const provider of this.providers.values()) {
      if (provider.shutdown) {
        await provider.shutdown();
      }
    }
    this.tools.clear();
    this.providers.clear();
    this.toolToProvider.clear();
    this.listeners.length = 0;
  }

  /** Number of registered tools. */
  get size(): number {
    return this.tools.size;
  }

  // ── Private ───────────────────────────────────────────────────

  private emit(event: RegistryEvent): void {
    for (const fn of this.listeners) {
      try {
        fn(event);
      } catch {
        /* listener errors must not break the registry */
      }
    }
  }
}
