/**
 * Custom Tool Manager — orchestrates config-driven tool registration.
 *
 * Responsibilities:
 * - Load custom tools from tools.config.yaml
 * - Validate and register tools with the ToolRegistry
 * - Watch config file for changes (hot-reload)
 * - Provide add/remove/list operations for custom tools
 * - Persist changes back to the config file
 */

import { EventEmitter } from 'node:events';
import { access, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import type { FSWatcher } from 'chokidar';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

import { CustomToolProvider } from './custom-tool-provider.js';
import { generateFromTemplate, getTemplate, getTemplates } from './tool-templates.js';
import { ToolValidator } from './tool-validator.js';
import type {
  CustomToolDescriptor,
  CustomToolExecution,
  CustomToolsConfigFile,
  ToolParameter,
  ToolTemplate,
} from './types.js';
import { ToolRegistry } from './tool-registry.js';

// ── Events ─────────────────────────────────────────────────────

export type CustomToolManagerEventType =
  | 'tools:loaded'
  | 'tools:reloaded'
  | 'tool:added'
  | 'tool:removed'
  | 'error';

export interface CustomToolManagerEvent {
  type: CustomToolManagerEventType;
  timestamp: number;
  details?: unknown;
}

// ── Options ────────────────────────────────────────────────────

export interface CustomToolManagerOptions {
  /** Path to the tools config file. Defaults to .squad/tools.config.yaml */
  configPath?: string;
  /** Enable hot-reload via file watching. Defaults to true. */
  watchEnabled?: boolean;
  /** Debounce interval for hot-reload in ms. Defaults to 200. */
  debounceMs?: number;
}

// ── Manager ────────────────────────────────────────────────────

export class CustomToolManager extends EventEmitter {
  private readonly configPath: string;
  private readonly watchEnabled: boolean;
  private readonly debounceMs: number;
  private readonly validator = new ToolValidator();
  private readonly provider = new CustomToolProvider();
  private registry: ToolRegistry | null = null;
  private watcher: FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: CustomToolManagerOptions = {}) {
    super();
    this.configPath = options.configPath ?? join(process.cwd(), '.squad', 'tools.config.yaml');
    this.watchEnabled = options.watchEnabled ?? true;
    this.debounceMs = options.debounceMs ?? 200;
  }

  /** The underlying provider (for registry integration). */
  getProvider(): CustomToolProvider {
    return this.provider;
  }

  /** The config file path. */
  getConfigPath(): string {
    return this.configPath;
  }

  // ── Lifecycle ────────────────────────────────────────────────

  /**
   * Initialize: load config, register tools, start watching.
   */
  async start(registry: ToolRegistry): Promise<{
    loaded: number;
    errors: Array<{ toolId: string; error: string }>;
  }> {
    this.registry = registry;

    // Register provider first
    if (!registry.getProviders().includes(this.provider.name)) {
      await registry.registerProvider(this.provider);
    }

    // Load tools from config
    const result = await this.loadConfig();

    // Start watching
    if (this.watchEnabled) {
      await this.startWatching();
    }

    this.emitEvent({ type: 'tools:loaded', timestamp: Date.now(), details: result });
    return result;
  }

  /**
   * Stop watching and clean up.
   */
  async stop(): Promise<void> {
    await this.stopWatching();
    this.registry = null;
  }

  // ── Config Loading ───────────────────────────────────────────

  /**
   * Load (or reload) tools from the config file.
   */
  async loadConfig(): Promise<{
    loaded: number;
    errors: Array<{ toolId: string; error: string }>;
  }> {
    const exists = await this.configExists();
    if (!exists) {
      return { loaded: 0, errors: [] };
    }

    const raw = await readFile(this.configPath, 'utf-8');
    const parsed = parseYaml(raw) as unknown;

    if (!parsed || typeof parsed !== 'object') {
      return { loaded: 0, errors: [{ toolId: '*', error: 'Config file is not a valid YAML object' }] };
    }

    const config = parsed as Partial<CustomToolsConfigFile>;
    if (!Array.isArray(config.tools)) {
      return { loaded: 0, errors: [{ toolId: '*', error: 'Config must have a "tools" array' }] };
    }

    // Unregister all existing custom tools first (for reload)
    this.unregisterAllFromRegistry();
    this.provider.clear();

    const errors: Array<{ toolId: string; error: string }> = [];
    let loaded = 0;

    for (const toolConfig of config.tools) {
      const toolId = toolConfig?.id ?? '(unknown)';
      try {
        this.registerSingleTool(toolConfig as CustomToolDescriptor);
        loaded++;
      } catch (err) {
        errors.push({ toolId, error: err instanceof Error ? err.message : String(err) });
      }
    }

    return { loaded, errors };
  }

  // ── CRUD Operations ──────────────────────────────────────────

  /**
   * Add a new custom tool and persist to config.
   */
  async addTool(descriptor: CustomToolDescriptor): Promise<void> {
    this.registerSingleTool(descriptor);
    await this.persistConfig();
    this.emitEvent({ type: 'tool:added', timestamp: Date.now(), details: { toolId: descriptor.id } });
  }

  /**
   * Add a tool from a template and persist to config.
   */
  async addToolFromTemplate(
    templateId: string,
    overrides: {
      id: string;
      name: string;
      description: string;
      version?: string;
      execution?: Partial<CustomToolExecution>;
      parameters?: ToolParameter[];
    },
  ): Promise<CustomToolDescriptor> {
    const descriptor = generateFromTemplate(templateId, overrides);
    await this.addTool(descriptor);
    return descriptor;
  }

  /**
   * Remove a custom tool by id and persist.
   */
  async removeTool(toolId: string): Promise<boolean> {
    if (!this.provider.hasTool(toolId)) {
      return false;
    }

    this.provider.removeTool(toolId);
    if (this.registry) {
      this.registry.unregister(toolId);
    }

    await this.persistConfig();
    this.emitEvent({ type: 'tool:removed', timestamp: Date.now(), details: { toolId } });
    return true;
  }

  /**
   * List all registered custom tools.
   */
  listTools(): CustomToolDescriptor[] {
    return this.provider.getAllCustomTools();
  }

  /**
   * Get a custom tool by id.
   */
  getTool(toolId: string): CustomToolDescriptor | undefined {
    return this.provider.getCustomTool(toolId);
  }

  /**
   * Get available templates.
   */
  getTemplates(): ToolTemplate[] {
    return getTemplates();
  }

  /**
   * Get a template by id.
   */
  getTemplate(templateId: string): ToolTemplate | undefined {
    return getTemplate(templateId);
  }

  // ── Hot Reload ───────────────────────────────────────────────

  private async startWatching(): Promise<void> {
    const exists = await this.configExists();
    // Watch the directory so we can detect file creation
    const watchPath = exists ? this.configPath : dirname(this.configPath);

    const { watch } = await import('chokidar');

    this.watcher = watch(watchPath, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 50, pollInterval: 25 },
    });

    const handleChange = (filePath: string) => {
      // Only react to our config file
      if (!filePath.endsWith('tools.config.yaml') && !filePath.endsWith('tools.config.yml')) {
        return;
      }

      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.handleReload(), this.debounceMs);
    };

    this.watcher.on('add', handleChange);
    this.watcher.on('change', handleChange);
    this.watcher.on('error', (err) => {
      this.emitEvent({ type: 'error', timestamp: Date.now(), details: err });
    });
  }

  private async stopWatching(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private async handleReload(): Promise<void> {
    try {
      const result = await this.loadConfig();
      this.emitEvent({ type: 'tools:reloaded', timestamp: Date.now(), details: result });
    } catch (err) {
      this.emitEvent({ type: 'error', timestamp: Date.now(), details: err });
    }
  }

  // ── Persistence ──────────────────────────────────────────────

  /**
   * Write the current tool set back to the config file.
   */
  async persistConfig(): Promise<void> {
    const config: CustomToolsConfigFile = {
      version: 1,
      tools: this.provider.getAllCustomTools(),
    };

    const yaml = stringifyYaml(config, { lineWidth: 120 });
    await writeFile(this.configPath, yaml, 'utf-8');
  }

  /**
   * Initialize a new config file (if it doesn't exist).
   */
  async initConfig(): Promise<boolean> {
    const exists = await this.configExists();
    if (exists) return false;

    const config: CustomToolsConfigFile = {
      version: 1,
      tools: [],
    };

    const yaml = stringifyYaml(config, { lineWidth: 120 });
    await writeFile(this.configPath, yaml, 'utf-8');
    return true;
  }

  // ── Private Helpers ──────────────────────────────────────────

  private registerSingleTool(descriptor: CustomToolDescriptor): void {
    // Validate the base descriptor
    const validation = this.validator.validateToolDescriptor(descriptor);
    if (!validation.valid) {
      throw new Error(
        `Invalid tool descriptor for "${descriptor.id ?? '(unknown)'}": ${validation.errors?.message}`,
      );
    }

    // Validate execution config
    if (!descriptor.execution || !descriptor.execution.mode) {
      throw new Error(`Tool "${descriptor.id}" is missing an "execution" config with a "mode" field`);
    }

    const validModes = ['rest-api', 'cli-command', 'file-processor'];
    if (!validModes.includes(descriptor.execution.mode)) {
      throw new Error(
        `Tool "${descriptor.id}" has invalid execution mode "${descriptor.execution.mode}". Valid: ${validModes.join(', ')}`,
      );
    }

    // Add to provider
    this.provider.addTool(descriptor);

    // Register with the registry if available
    if (this.registry && !this.registry.getTool(descriptor.id)) {
      this.registry.register(descriptor, this.provider);
    }
  }

  private unregisterAllFromRegistry(): void {
    if (!this.registry) return;
    for (const tool of this.provider.getAllCustomTools()) {
      this.registry.unregister(tool.id);
    }
  }

  private async configExists(): Promise<boolean> {
    try {
      await access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  private emitEvent(event: CustomToolManagerEvent): void {
    this.emit(event.type, event);
    this.emit('change', event);
  }
}
