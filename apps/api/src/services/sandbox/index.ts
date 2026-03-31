/**
 * Sandbox service — public API.
 *
 * Orchestrates ContainerPool + ContainerManager to provide a high-level
 * interface for sandbox lifecycle management.
 */

export { ContainerManager } from './container-manager.js';
export { ContainerPool, PoolCapacityError } from './container-pool.js';
export {
  DEFAULT_POOL_CONFIG,
  DEFAULT_RESOURCE_LIMITS,
  type ExecRequest,
  type ExecResult,
  type PoolConfig,
  type ResourceLimits,
  RUNTIME_IMAGES,
  SANDBOX_RUNTIMES,
  type SandboxConfig,
  type SandboxInfo,
  type SandboxRuntime,
  type SandboxStatus,
  type StreamChunk,
  type StreamEnd,
} from './types.js';

import { ContainerManager } from './container-manager.js';
import { ContainerPool } from './container-pool.js';
import type {
  ExecRequest,
  ExecResult,
  PoolConfig,
  SandboxConfig,
  SandboxInfo,
  StreamChunk,
  StreamEnd,
} from './types.js';

/**
 * SandboxService — the main entry point used by routes.
 *
 * Manages the full sandbox lifecycle: create, execute, stream, retrieve files, destroy.
 */
export class SandboxService {
  readonly pool: ContainerPool;
  readonly manager: ContainerManager;

  constructor(config?: PoolConfig) {
    this.manager = new ContainerManager();
    this.pool = new ContainerPool(this.manager, config);
  }

  /**
   * Create a new sandbox container.
   */
  async create(config: SandboxConfig): Promise<SandboxInfo> {
    return this.pool.acquire({
      runtime: config.runtime,
      limits: config.limits,
      env: config.env,
    });
  }

  /**
   * Execute a command in a sandbox. Returns the full result.
   */
  async exec(sandboxId: string, request: ExecRequest): Promise<ExecResult> {
    const info = this.pool.get(sandboxId);
    if (!info) {
      throw new SandboxNotFoundError(sandboxId);
    }
    if (info.status === 'destroyed') {
      throw new SandboxDestroyedError(sandboxId);
    }

    this.pool.markBusy(sandboxId);
    try {
      const result = await this.manager.exec(info.containerId, request);
      return result;
    } finally {
      this.pool.markReady(sandboxId);
    }
  }

  /**
   * Copy a file/directory from a sandbox as a tar buffer.
   */
  async copyFrom(sandboxId: string, containerPath: string): Promise<Buffer> {
    const info = this.pool.get(sandboxId);
    if (!info) {
      throw new SandboxNotFoundError(sandboxId);
    }
    return this.manager.copyFrom(info.containerId, containerPath);
  }

  /**
   * Get sandbox info by ID.
   */
  get(sandboxId: string): SandboxInfo | undefined {
    return this.pool.get(sandboxId);
  }

  /**
   * List all active sandboxes, optionally filtered.
   */
  list(filters?: { status?: string; runtime?: string }): SandboxInfo[] {
    let sandboxes = this.pool.list();
    if (filters?.status) {
      sandboxes = sandboxes.filter((s) => s.status === filters.status);
    }
    if (filters?.runtime) {
      sandboxes = sandboxes.filter((s) => s.runtime === filters.runtime);
    }
    return sandboxes;
  }

  /**
   * Stop a running sandbox (container stays in pool as 'stopped').
   */
  async stop(sandboxId: string): Promise<void> {
    const info = this.pool.get(sandboxId);
    if (!info) {
      throw new SandboxNotFoundError(sandboxId);
    }
    if (info.status === 'stopped') return; // already stopped
    if (info.status !== 'ready' && info.status !== 'busy') {
      throw new SandboxStoppedError(sandboxId);
    }
    await this.pool.stop(sandboxId);
  }

  /**
   * Restart a stopped sandbox.
   */
  async restart(sandboxId: string): Promise<void> {
    const info = this.pool.get(sandboxId);
    if (!info) {
      throw new SandboxNotFoundError(sandboxId);
    }
    if (info.status !== 'stopped') {
      throw new SandboxNotStoppedError(sandboxId);
    }
    await this.pool.restart(sandboxId);
  }

  /**
   * Destroy a sandbox.
   */
  async destroy(sandboxId: string): Promise<void> {
    return this.pool.release(sandboxId);
  }

  /**
   * Register a listener for streaming exec output.
   */
  onStreamData(handler: (chunk: StreamChunk) => void): void {
    this.manager.on('stream:data', handler);
  }

  /**
   * Register a listener for exec completion.
   */
  onStreamEnd(handler: (end: StreamEnd) => void): void {
    this.manager.on('stream:end', handler);
  }

  /**
   * Remove stream listeners.
   */
  offStreamData(handler: (chunk: StreamChunk) => void): void {
    this.manager.off('stream:data', handler);
  }

  offStreamEnd(handler: (end: StreamEnd) => void): void {
    this.manager.off('stream:end', handler);
  }

  /**
   * Start the pool (warmup + idle cleanup).
   */
  async start(): Promise<void> {
    await this.pool.warmup();
    this.pool.startIdleCleanup();
  }

  /**
   * Shut down all sandboxes.
   */
  async shutdown(): Promise<void> {
    await this.pool.shutdown();
  }
}

// ── Error types ─────────────────────────────────────────────────

export class SandboxNotFoundError extends Error {
  readonly code = 'SANDBOX_NOT_FOUND';

  constructor(sandboxId: string) {
    super(`Sandbox not found: ${sandboxId}`);
    this.name = 'SandboxNotFoundError';
  }
}

export class SandboxDestroyedError extends Error {
  readonly code = 'SANDBOX_DESTROYED';

  constructor(sandboxId: string) {
    super(`Sandbox already destroyed: ${sandboxId}`);
    this.name = 'SandboxDestroyedError';
  }
}

export class SandboxStoppedError extends Error {
  readonly code = 'SANDBOX_NOT_RUNNING';

  constructor(sandboxId: string) {
    super(`Sandbox is not running: ${sandboxId}`);
    this.name = 'SandboxStoppedError';
  }
}

export class SandboxNotStoppedError extends Error {
  readonly code = 'SANDBOX_NOT_STOPPED';

  constructor(sandboxId: string) {
    super(`Sandbox is not stopped: ${sandboxId}`);
    this.name = 'SandboxNotStoppedError';
  }
}
