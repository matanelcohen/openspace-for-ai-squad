/**
 * SandboxService integration tests.
 *
 * Tests the SandboxService orchestration layer with a mocked ContainerManager,
 * covering full lifecycle, error propagation, stream events, concurrent
 * sandbox isolation, and pool capacity enforcement.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ContainerManager } from '../container-manager.js';
import { PoolCapacityError } from '../container-pool.js';
import { SandboxDestroyedError, SandboxNotFoundError, SandboxService } from '../index.js';
import type { ExecResult } from '../types.js';

// ── Mock ContainerManager ─────────────────────────────────────────

function createMockManager() {
  let counter = 0;
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>();

  const manager = {
    create: vi.fn().mockImplementation(async () => `container-${++counter}`),
    destroy: vi.fn().mockResolvedValue(undefined),
    exec: vi.fn().mockImplementation(
      async (_containerId: string, request: { command: string }): Promise<ExecResult> => ({
        execId: `exec-${Date.now()}`,
        exitCode: 0,
        stdout: `output of: ${request.command}\n`,
        stderr: '',
        timedOut: false,
        durationMs: 42,
      }),
    ),
    isRunning: vi.fn().mockResolvedValue(true),
    copyFrom: vi.fn().mockResolvedValue(Buffer.from('tar-data')),
    on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
    }),
    off: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      handlers.get(event)?.delete(handler);
    }),
    emit: vi.fn().mockImplementation((event: string, ...args: unknown[]) => {
      handlers.get(event)?.forEach((h) => h(...args));
    }),
  } as unknown as ContainerManager;

  return { manager, handlers };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('SandboxService', () => {
  let service: SandboxService;
  let mockManager: ReturnType<typeof createMockManager>['manager'];

  beforeEach(() => {
    const mocks = createMockManager();
    mockManager = mocks.manager;

    // Construct with injected mocks
    service = new SandboxService({ maxTotal: 5, minPerRuntime: 0, idleTimeoutMs: 600_000 });
    // Replace internals with our mock
    (service as unknown as { manager: ContainerManager }).manager = mockManager;
    (service.pool as unknown as { manager: ContainerManager }).manager = mockManager;
  });

  afterEach(async () => {
    await service.shutdown();
    vi.restoreAllMocks();
  });

  // ── Full lifecycle ──────────────────────────────────────────────

  describe('create → exec → destroy lifecycle', () => {
    it('creates a sandbox with correct runtime and ready status', async () => {
      const info = await service.create({ runtime: 'node' });

      expect(info.id).toBeDefined();
      expect(info.runtime).toBe('node');
      expect(info.status).toBe('ready');
      expect(info.containerId).toMatch(/^container-/);
      expect(info.createdAt).toBeDefined();
      expect(info.limits.cpuShares).toBe(1024);
      expect(info.limits.memoryBytes).toBe(512 * 1024 * 1024);
    });

    it('executes a command and returns the result', async () => {
      const info = await service.create({ runtime: 'node' });
      const result = await service.exec(info.id, { command: 'echo hello' });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('echo hello');
      expect(result.timedOut).toBe(false);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('sandbox returns to ready status after exec', async () => {
      const info = await service.create({ runtime: 'node' });
      await service.exec(info.id, { command: 'ls' });

      const updated = service.get(info.id);
      expect(updated?.status).toBe('ready');
    });

    it('destroys a sandbox and removes it from the pool', async () => {
      const info = await service.create({ runtime: 'node' });
      expect(service.list()).toHaveLength(1);

      await service.destroy(info.id);

      expect(service.list()).toHaveLength(0);
      expect(service.get(info.id)).toBeUndefined();
      expect(mockManager.destroy).toHaveBeenCalledWith(info.containerId);
    });

    it('completes full create → exec → exec → destroy lifecycle', async () => {
      const info = await service.create({ runtime: 'python' });

      const r1 = await service.exec(info.id, { command: 'python --version' });
      expect(r1.exitCode).toBe(0);

      const r2 = await service.exec(info.id, { command: 'pip install requests' });
      expect(r2.exitCode).toBe(0);

      await service.destroy(info.id);
      expect(service.get(info.id)).toBeUndefined();
    });
  });

  // ── Multi-runtime ───────────────────────────────────────────────

  describe('multi-runtime execution', () => {
    it('creates sandboxes for node, python, and go', async () => {
      const node = await service.create({ runtime: 'node' });
      const python = await service.create({ runtime: 'python' });
      const go = await service.create({ runtime: 'go' });

      expect(node.runtime).toBe('node');
      expect(python.runtime).toBe('python');
      expect(go.runtime).toBe('go');
      expect(service.list()).toHaveLength(3);
    });

    it('each runtime sandbox is independently executable', async () => {
      const node = await service.create({ runtime: 'node' });
      const python = await service.create({ runtime: 'python' });
      const go = await service.create({ runtime: 'go' });

      const [r1, r2, r3] = await Promise.all([
        service.exec(node.id, { command: 'node -e "console.log(1)"' }),
        service.exec(python.id, { command: 'python -c "print(1)"' }),
        service.exec(go.id, { command: 'go version' }),
      ]);

      expect(r1.exitCode).toBe(0);
      expect(r2.exitCode).toBe(0);
      expect(r3.exitCode).toBe(0);
    });
  });

  // ── Resource limits ─────────────────────────────────────────────

  describe('resource limit enforcement', () => {
    it('applies custom resource limits on creation', async () => {
      const info = await service.create({
        runtime: 'node',
        limits: { cpuShares: 512, memoryBytes: 256 * 1024 * 1024, timeoutMs: 10_000 },
      });

      expect(info.limits.cpuShares).toBe(512);
      expect(info.limits.memoryBytes).toBe(256 * 1024 * 1024);
      expect(info.limits.timeoutMs).toBe(10_000);
    });

    it('merges partial limits with defaults', async () => {
      const info = await service.create({
        runtime: 'node',
        limits: { cpuShares: 512 },
      });

      expect(info.limits.cpuShares).toBe(512);
      expect(info.limits.memoryBytes).toBe(512 * 1024 * 1024); // default
      expect(info.limits.timeoutMs).toBe(300_000); // default
    });

    it('passes per-exec timeout override to manager', async () => {
      const info = await service.create({ runtime: 'node' });
      await service.exec(info.id, { command: 'sleep 1', timeoutMs: 500 });

      expect(mockManager.exec).toHaveBeenCalledWith(
        info.containerId,
        expect.objectContaining({ timeoutMs: 500 }),
      );
    });

    it('reports timedOut=true when command exceeds timeout', async () => {
      (mockManager.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        execId: 'exec-timeout',
        exitCode: -1,
        stdout: '',
        stderr: '',
        timedOut: true,
        durationMs: 5001,
      });

      const info = await service.create({ runtime: 'node' });
      const result = await service.exec(info.id, { command: 'sleep 1000', timeoutMs: 5000 });

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(-1);
    });
  });

  // ── Pool capacity ───────────────────────────────────────────────

  describe('pool capacity enforcement', () => {
    it('throws PoolCapacityError when pool is full', async () => {
      // Pool maxTotal is 5
      for (let i = 0; i < 5; i++) {
        await service.create({ runtime: 'node' });
      }

      await expect(service.create({ runtime: 'node' })).rejects.toThrow(PoolCapacityError);
    });

    it('allows creation after destroying a sandbox', async () => {
      const sandboxes = [];
      for (let i = 0; i < 5; i++) {
        sandboxes.push(await service.create({ runtime: 'node' }));
      }

      await service.destroy(sandboxes[0].id);
      const newSandbox = await service.create({ runtime: 'python' });
      expect(newSandbox.runtime).toBe('python');
    });
  });

  // ── Concurrent sandbox isolation ────────────────────────────────

  describe('concurrent sandbox isolation', () => {
    it('two sandboxes have different IDs and container IDs', async () => {
      const sb1 = await service.create({ runtime: 'node' });
      const sb2 = await service.create({ runtime: 'node' });

      expect(sb1.id).not.toBe(sb2.id);
      expect(sb1.containerId).not.toBe(sb2.containerId);
    });

    it('destroying one sandbox does not affect another', async () => {
      const sb1 = await service.create({ runtime: 'node' });
      const sb2 = await service.create({ runtime: 'python' });

      await service.destroy(sb1.id);

      expect(service.get(sb1.id)).toBeUndefined();
      expect(service.get(sb2.id)).toBeDefined();
      expect(service.get(sb2.id)?.status).toBe('ready');
    });

    it('exec on one sandbox does not change another sandbox status', async () => {
      const sb1 = await service.create({ runtime: 'node' });
      const sb2 = await service.create({ runtime: 'python' });

      await service.exec(sb1.id, { command: 'echo 1' });

      // sb2 should still be ready, not affected
      expect(service.get(sb2.id)?.status).toBe('ready');
    });

    it('concurrent exec calls on different sandboxes work independently', async () => {
      let callCount = 0;
      (mockManager.exec as ReturnType<typeof vi.fn>).mockImplementation(
        async (containerId: string) => {
          callCount++;
          return {
            execId: `exec-${callCount}`,
            exitCode: 0,
            stdout: `output from ${containerId}\n`,
            stderr: '',
            timedOut: false,
            durationMs: 10,
          };
        },
      );

      const sb1 = await service.create({ runtime: 'node' });
      const sb2 = await service.create({ runtime: 'python' });

      const [r1, r2] = await Promise.all([
        service.exec(sb1.id, { command: 'echo a' }),
        service.exec(sb2.id, { command: 'echo b' }),
      ]);

      expect(r1.stdout).toContain(sb1.containerId);
      expect(r2.stdout).toContain(sb2.containerId);
    });
  });

  // ── Error handling ──────────────────────────────────────────────

  describe('error handling', () => {
    it('throws SandboxNotFoundError for exec on unknown ID', async () => {
      await expect(service.exec('nonexistent', { command: 'ls' })).rejects.toThrow(
        SandboxNotFoundError,
      );
    });

    it('throws SandboxDestroyedError for exec on destroyed sandbox', async () => {
      const info = await service.create({ runtime: 'node' });
      // Manually mark as destroyed in the pool without removing
      const entry = (
        service.pool as unknown as { entries: Map<string, { info: { status: string } }> }
      ).entries.get(info.id);
      if (entry) entry.info.status = 'destroyed';

      await expect(service.exec(info.id, { command: 'ls' })).rejects.toThrow(SandboxDestroyedError);
    });

    it('propagates container creation failure', async () => {
      (mockManager.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Docker daemon unavailable'),
      );

      await expect(service.create({ runtime: 'node' })).rejects.toThrow(
        'Docker daemon unavailable',
      );
      expect(service.list()).toHaveLength(0);
    });

    it('returns exec result with non-zero exit code for bad commands', async () => {
      (mockManager.exec as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        execId: 'exec-fail',
        exitCode: 127,
        stdout: '',
        stderr: 'sh: command_not_found: not found\n',
        timedOut: false,
        durationMs: 5,
      });

      const info = await service.create({ runtime: 'node' });
      const result = await service.exec(info.id, { command: 'command_not_found' });

      expect(result.exitCode).toBe(127);
      expect(result.stderr).toContain('not found');
    });

    it('sandbox returns to ready after exec failure', async () => {
      (mockManager.exec as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
        new Error('Container crashed'),
      );

      const info = await service.create({ runtime: 'node' });

      await expect(service.exec(info.id, { command: 'crash' })).rejects.toThrow(
        'Container crashed',
      );

      // Should still be marked ready (finally block in exec)
      expect(service.get(info.id)?.status).toBe('ready');
    });
  });

  // ── Stream event wiring ─────────────────────────────────────────

  describe('stream event wiring', () => {
    it('onStreamData registers a listener on the manager', () => {
      const handler = vi.fn();
      service.onStreamData(handler);

      expect(mockManager.on).toHaveBeenCalledWith('stream:data', handler);
    });

    it('onStreamEnd registers a listener on the manager', () => {
      const handler = vi.fn();
      service.onStreamEnd(handler);

      expect(mockManager.on).toHaveBeenCalledWith('stream:end', handler);
    });

    it('offStreamData removes the listener', () => {
      const handler = vi.fn();
      service.onStreamData(handler);
      service.offStreamData(handler);

      expect(mockManager.off).toHaveBeenCalledWith('stream:data', handler);
    });

    it('offStreamEnd removes the listener', () => {
      const handler = vi.fn();
      service.onStreamEnd(handler);
      service.offStreamEnd(handler);

      expect(mockManager.off).toHaveBeenCalledWith('stream:end', handler);
    });
  });

  // ── copyFrom ────────────────────────────────────────────────────

  describe('copyFrom', () => {
    it('retrieves a file from a sandbox', async () => {
      const info = await service.create({ runtime: 'node' });
      const buf = await service.copyFrom(info.id, '/workspace/output.txt');

      expect(buf.toString()).toBe('tar-data');
      expect(mockManager.copyFrom).toHaveBeenCalledWith(info.containerId, '/workspace/output.txt');
    });

    it('throws SandboxNotFoundError for unknown sandbox', async () => {
      await expect(service.copyFrom('nonexistent', '/workspace/file')).rejects.toThrow(
        SandboxNotFoundError,
      );
    });
  });

  // ── Shutdown ────────────────────────────────────────────────────

  describe('shutdown', () => {
    it('destroys all sandboxes on shutdown', async () => {
      await service.create({ runtime: 'node' });
      await service.create({ runtime: 'python' });
      await service.create({ runtime: 'go' });

      expect(service.list()).toHaveLength(3);

      await service.shutdown();

      expect(service.list()).toHaveLength(0);
      expect(mockManager.destroy).toHaveBeenCalledTimes(3);
    });
  });
});
