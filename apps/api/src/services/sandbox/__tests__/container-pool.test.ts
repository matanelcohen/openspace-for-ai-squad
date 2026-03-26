/**
 * ContainerPool unit tests.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContainerManager } from '../container-manager.js';
import { ContainerPool, PoolCapacityError } from '../container-pool.js';

// ── Mock ContainerManager ─────────────────────────────────────────

function createMockManager() {
  let counter = 0;
  const manager = {
    create: vi.fn().mockImplementation(async () => `container-${++counter}`),
    destroy: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockResolvedValue({
      execId: 'exec-1',
      exitCode: 0,
      stdout: '',
      stderr: '',
      timedOut: false,
      durationMs: 100,
    }),
    isRunning: vi.fn().mockResolvedValue(true),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as ContainerManager;

  return manager;
}

// ── Tests ─────────────────────────────────────────────────────────

describe('ContainerPool', () => {
  let manager: ContainerManager;
  let pool: ContainerPool;

  beforeEach(() => {
    manager = createMockManager();
    pool = new ContainerPool(manager, { maxTotal: 3, idleTimeoutMs: 1000, minPerRuntime: 0 });
  });

  afterEach(async () => {
    await pool.shutdown();
    vi.restoreAllMocks();
  });

  describe('acquire', () => {
    it('creates a new sandbox and returns info', async () => {
      const info = await pool.acquire({ runtime: 'node' });

      expect(info.id).toBeDefined();
      expect(info.containerId).toBe('container-1');
      expect(info.runtime).toBe('node');
      expect(info.status).toBe('ready');
      expect(info.createdAt).toBeDefined();
      expect(pool.size).toBe(1);
    });

    it('applies default resource limits', async () => {
      const info = await pool.acquire({ runtime: 'python' });

      expect(info.limits.cpuShares).toBe(1024);
      expect(info.limits.memoryBytes).toBe(512 * 1024 * 1024);
      expect(info.limits.timeoutMs).toBe(300_000);
    });

    it('allows custom resource limits', async () => {
      const info = await pool.acquire({
        runtime: 'go',
        limits: { cpuShares: 2048, memoryBytes: 1024 * 1024 * 1024 },
      });

      expect(info.limits.cpuShares).toBe(2048);
      expect(info.limits.memoryBytes).toBe(1024 * 1024 * 1024);
    });

    it('throws PoolCapacityError when at max', async () => {
      await pool.acquire({ runtime: 'node' });
      await pool.acquire({ runtime: 'python' });
      await pool.acquire({ runtime: 'go' });

      await expect(pool.acquire({ runtime: 'node' })).rejects.toThrow(PoolCapacityError);
      await expect(pool.acquire({ runtime: 'node' })).rejects.toThrow(/Pool at max capacity/);
    });

    it('handles container creation failure', async () => {
      (manager.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Docker daemon unavailable'),
      );

      await expect(pool.acquire({ runtime: 'node' })).rejects.toThrow('Docker daemon unavailable');
      expect(pool.size).toBe(0);
    });
  });

  describe('get / list', () => {
    it('retrieves sandbox by ID', async () => {
      const info = await pool.acquire({ runtime: 'node' });
      const found = pool.get(info.id);

      expect(found).toBeDefined();
      expect(found?.id).toBe(info.id);
    });

    it('returns undefined for unknown ID', () => {
      expect(pool.get('nonexistent')).toBeUndefined();
    });

    it('lists all sandboxes', async () => {
      await pool.acquire({ runtime: 'node' });
      await pool.acquire({ runtime: 'python' });

      const all = pool.list();
      expect(all).toHaveLength(2);
      expect(all.map((s) => s.runtime)).toContain('node');
      expect(all.map((s) => s.runtime)).toContain('python');
    });
  });

  describe('markBusy / markReady', () => {
    it('transitions sandbox between ready and busy', async () => {
      const info = await pool.acquire({ runtime: 'node' });

      pool.markBusy(info.id);
      expect(pool.get(info.id)?.status).toBe('busy');

      pool.markReady(info.id);
      expect(pool.get(info.id)?.status).toBe('ready');
    });
  });

  describe('release', () => {
    it('destroys sandbox and removes from pool', async () => {
      const info = await pool.acquire({ runtime: 'node' });
      expect(pool.size).toBe(1);

      await pool.release(info.id);
      expect(pool.size).toBe(0);
      expect(pool.get(info.id)).toBeUndefined();
      expect(manager.destroy).toHaveBeenCalledWith(info.containerId);
    });

    it('is idempotent for unknown IDs', async () => {
      await expect(pool.release('nonexistent')).resolves.toBeUndefined();
    });
  });

  describe('shutdown', () => {
    it('destroys all containers', async () => {
      await pool.acquire({ runtime: 'node' });
      await pool.acquire({ runtime: 'python' });

      await pool.shutdown();
      expect(pool.size).toBe(0);
      expect(manager.destroy).toHaveBeenCalledTimes(2);
    });
  });
});
