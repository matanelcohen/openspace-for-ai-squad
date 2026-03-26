/**
 * ContainerPool — Pre-warmed container pool with idle cleanup.
 *
 * Maintains a set of ready-to-use containers per runtime, automatically
 * destroying idle ones and enforcing global capacity limits.
 */

import { nanoid } from 'nanoid';

import type { ContainerManager } from './container-manager.js';
import { type ContainerCreateOptions } from './container-manager.js';
import {
  DEFAULT_POOL_CONFIG,
  DEFAULT_RESOURCE_LIMITS,
  type PoolConfig,
  type ResourceLimits,
  SANDBOX_RUNTIMES,
  type SandboxInfo,
  type SandboxRuntime,
} from './types.js';

interface PoolEntry {
  info: SandboxInfo;
  lastActivity: number;
}

export class ContainerPool {
  private manager: ContainerManager;
  private config: Required<PoolConfig>;
  private entries = new Map<string, PoolEntry>();
  private idleTimer: ReturnType<typeof setInterval> | null = null;

  constructor(manager: ContainerManager, config?: PoolConfig) {
    this.manager = manager;
    this.config = { ...DEFAULT_POOL_CONFIG, ...config };
  }

  /** Get the underlying ContainerManager. */
  getManager(): ContainerManager {
    return this.manager;
  }

  /** Total number of active sandboxes (all statuses except destroyed). */
  get size(): number {
    return this.entries.size;
  }

  /** Get all sandbox infos. */
  list(): SandboxInfo[] {
    return [...this.entries.values()].map((e) => e.info);
  }

  /** Get a sandbox by ID. */
  get(sandboxId: string): SandboxInfo | undefined {
    return this.entries.get(sandboxId)?.info;
  }

  /**
   * Acquire a sandbox — either create a new one or repurpose a ready idle one.
   * Throws if the pool is at max capacity.
   */
  async acquire(opts: {
    runtime: SandboxRuntime;
    limits?: ResourceLimits;
    env?: Record<string, string>;
  }): Promise<SandboxInfo> {
    if (this.entries.size >= this.config.maxTotal) {
      throw new PoolCapacityError(
        `Pool at max capacity (${this.config.maxTotal}). Destroy a sandbox first.`,
      );
    }

    const sandboxId = nanoid(12);
    const limits: Required<ResourceLimits> = {
      ...DEFAULT_RESOURCE_LIMITS,
      ...opts.limits,
    };

    const info: SandboxInfo = {
      id: sandboxId,
      containerId: '', // filled after create
      runtime: opts.runtime,
      status: 'creating',
      limits,
      createdAt: new Date().toISOString(),
    };

    this.entries.set(sandboxId, { info, lastActivity: Date.now() });

    try {
      const createOpts: ContainerCreateOptions = {
        runtime: opts.runtime,
        limits: opts.limits,
        env: opts.env,
      };
      const containerId = await this.manager.create(createOpts);
      info.containerId = containerId;
      info.status = 'ready';
    } catch (err) {
      info.status = 'error';
      this.entries.delete(sandboxId);
      throw err;
    }

    return info;
  }

  /**
   * Mark a sandbox as busy (during command execution).
   */
  markBusy(sandboxId: string): void {
    const entry = this.entries.get(sandboxId);
    if (entry && entry.info.status === 'ready') {
      entry.info.status = 'busy';
      entry.lastActivity = Date.now();
    }
  }

  /**
   * Mark a sandbox as ready (after command execution completes).
   */
  markReady(sandboxId: string): void {
    const entry = this.entries.get(sandboxId);
    if (entry && entry.info.status === 'busy') {
      entry.info.status = 'ready';
      entry.lastActivity = Date.now();
    }
  }

  /**
   * Destroy a sandbox and release resources.
   */
  async release(sandboxId: string): Promise<void> {
    const entry = this.entries.get(sandboxId);
    if (!entry) return;

    entry.info.status = 'destroyed';
    this.entries.delete(sandboxId);

    try {
      await this.manager.destroy(entry.info.containerId);
    } catch {
      // best-effort cleanup
    }
  }

  /**
   * Start the idle cleanup timer. Destroys containers that have been
   * idle longer than `idleTimeoutMs`.
   */
  startIdleCleanup(): void {
    if (this.idleTimer) return;

    const interval = Math.min(this.config.idleTimeoutMs, 60_000);
    this.idleTimer = setInterval(() => {
      this.cleanupIdle();
    }, interval);
  }

  /** Stop the idle cleanup timer. */
  stopIdleCleanup(): void {
    if (this.idleTimer) {
      clearInterval(this.idleTimer);
      this.idleTimer = null;
    }
  }

  /**
   * Pre-warm the pool: create `minPerRuntime` containers for each runtime.
   */
  async warmup(): Promise<void> {
    if (this.config.minPerRuntime <= 0) return;

    const promises: Promise<void>[] = [];
    for (const runtime of SANDBOX_RUNTIMES) {
      const currentCount = [...this.entries.values()].filter(
        (e) => e.info.runtime === runtime && e.info.status === 'ready',
      ).length;
      const needed = this.config.minPerRuntime - currentCount;

      for (let i = 0; i < needed; i++) {
        promises.push(
          this.acquire({ runtime }).then(() => {
            // acquired — just warming, no further action
          }),
        );
      }
    }

    await Promise.allSettled(promises);
  }

  /**
   * Destroy all containers and clear the pool.
   */
  async shutdown(): Promise<void> {
    this.stopIdleCleanup();

    const destroyPromises = [...this.entries.keys()].map((id) => this.release(id));
    await Promise.allSettled(destroyPromises);
  }

  // ── Private ───────────────────────────────────────────────────

  private cleanupIdle(): void {
    const now = Date.now();
    const cutoff = now - this.config.idleTimeoutMs;

    for (const [id, entry] of this.entries) {
      if (entry.info.status === 'ready' && entry.lastActivity < cutoff) {
        // Count how many ready containers exist for this runtime
        const readyCount = [...this.entries.values()].filter(
          (e) => e.info.runtime === entry.info.runtime && e.info.status === 'ready',
        ).length;

        // Keep at least minPerRuntime
        if (readyCount > this.config.minPerRuntime) {
          this.release(id).catch(() => {
            // best-effort
          });
        }
      }
    }
  }
}

// ── Error types ─────────────────────────────────────────────────

export class PoolCapacityError extends Error {
  readonly code = 'POOL_CAPACITY_EXCEEDED';

  constructor(message: string) {
    super(message);
    this.name = 'PoolCapacityError';
  }
}
