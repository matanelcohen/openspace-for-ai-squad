/**
 * Sandboxes route tests.
 *
 * Mocks the SandboxService to test HTTP layer behavior.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.js';
import { SandboxNotFoundError } from '../services/sandbox/index.js';

// ── Mock SandboxService at the module level ───────────────────────

const mockSandboxService = {
  create: vi.fn(),
  exec: vi.fn(),
  copyFrom: vi.fn(),
  get: vi.fn(),
  list: vi.fn(),
  destroy: vi.fn(),
  stop: vi.fn(),
  restart: vi.fn(),
  onStreamData: vi.fn(),
  onStreamEnd: vi.fn(),
  offStreamData: vi.fn(),
  offStreamEnd: vi.fn(),
  start: vi.fn().mockResolvedValue(undefined),
  shutdown: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../services/sandbox/index.js', async (importOriginal) => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    SandboxService: vi.fn().mockImplementation(() => mockSandboxService),
  };
});

// ── Tests ─────────────────────────────────────────────────────────

describe('Sandboxes API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/sandboxes', () => {
    it('creates a sandbox with valid runtime', async () => {
      const sandbox = {
        id: 'sb-123',
        containerId: 'c-abc',
        runtime: 'node',
        status: 'ready',
        limits: { cpuShares: 1024, memoryBytes: 536870912, timeoutMs: 300000 },
        createdAt: '2026-01-01T00:00:00.000Z',
      };
      mockSandboxService.create.mockResolvedValueOnce(sandbox);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes',
        payload: { runtime: 'node' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.id).toBe('sb-123');
      expect(body.runtime).toBe('node');
      expect(body.status).toBe('ready');
    });

    it('rejects invalid runtime', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes',
        payload: { runtime: 'ruby' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe('VALIDATION_ERROR');
    });

    it('returns 429 when pool is full', async () => {
      const error = new Error('Pool at max capacity (10)');
      (error as Error & { code: string }).code = 'POOL_CAPACITY_EXCEEDED';
      mockSandboxService.create.mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes',
        payload: { runtime: 'node' },
      });

      expect(response.statusCode).toBe(429);
    });
  });

  describe('GET /api/sandboxes', () => {
    it('lists all sandboxes', async () => {
      mockSandboxService.list.mockReturnValueOnce([
        { id: 'sb-1', runtime: 'node', status: 'ready' },
        { id: 'sb-2', runtime: 'python', status: 'busy' },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sandboxes',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveLength(2);
    });

    it('passes status filter to service', async () => {
      mockSandboxService.list.mockReturnValueOnce([
        { id: 'sb-1', runtime: 'node', status: 'ready' },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sandboxes?status=ready',
      });

      expect(response.statusCode).toBe(200);
      expect(mockSandboxService.list).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'ready' }),
      );
    });

    it('passes runtime filter to service', async () => {
      mockSandboxService.list.mockReturnValueOnce([
        { id: 'sb-1', runtime: 'python', status: 'ready' },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sandboxes?runtime=python',
      });

      expect(response.statusCode).toBe(200);
      expect(mockSandboxService.list).toHaveBeenCalledWith(
        expect.objectContaining({ runtime: 'python' }),
      );
    });
  });

  describe('GET /api/sandboxes/:id', () => {
    it('returns sandbox info', async () => {
      mockSandboxService.get.mockReturnValueOnce({
        id: 'sb-1',
        runtime: 'node',
        status: 'ready',
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/sandboxes/sb-1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().id).toBe('sb-1');
    });

    it('returns 404 for unknown sandbox', async () => {
      mockSandboxService.get.mockReturnValueOnce(undefined);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sandboxes/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/sandboxes/:id/exec', () => {
    it('executes a command', async () => {
      const result = {
        execId: 'exec-1',
        exitCode: 0,
        stdout: 'hello\n',
        stderr: '',
        timedOut: false,
        durationMs: 42,
      };
      mockSandboxService.exec.mockResolvedValueOnce(result);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes/sb-1/exec',
        payload: { command: 'echo hello' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.exitCode).toBe(0);
      expect(body.stdout).toBe('hello\n');
    });

    it('rejects missing command', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes/sb-1/exec',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 404 for unknown sandbox', async () => {
      mockSandboxService.exec.mockRejectedValueOnce(new SandboxNotFoundError('sb-unknown'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes/sb-unknown/exec',
        payload: { command: 'ls' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /api/sandboxes/:id/stop', () => {
    it('stops a running sandbox', async () => {
      mockSandboxService.stop.mockResolvedValueOnce(undefined);
      mockSandboxService.get.mockReturnValueOnce({
        id: 'sb-1',
        runtime: 'node',
        status: 'stopped',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes/sb-1/stop',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('stopped');
    });

    it('returns 404 for unknown sandbox', async () => {
      mockSandboxService.stop.mockRejectedValueOnce(new SandboxNotFoundError('sb-unknown'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes/sb-unknown/stop',
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 409 when sandbox is not running', async () => {
      const { SandboxStoppedError } = await import('../services/sandbox/index.js');
      mockSandboxService.stop.mockRejectedValueOnce(new SandboxStoppedError('sb-1'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes/sb-1/stop',
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('POST /api/sandboxes/:id/restart', () => {
    it('restarts a stopped sandbox', async () => {
      mockSandboxService.restart.mockResolvedValueOnce(undefined);
      mockSandboxService.get.mockReturnValueOnce({
        id: 'sb-1',
        runtime: 'node',
        status: 'ready',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes/sb-1/restart',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json().status).toBe('ready');
    });

    it('returns 404 for unknown sandbox', async () => {
      mockSandboxService.restart.mockRejectedValueOnce(new SandboxNotFoundError('sb-unknown'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes/sb-unknown/restart',
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 409 when sandbox is not stopped', async () => {
      const { SandboxNotStoppedError } = await import('../services/sandbox/index.js');
      mockSandboxService.restart.mockRejectedValueOnce(new SandboxNotStoppedError('sb-1'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/sandboxes/sb-1/restart',
      });

      expect(response.statusCode).toBe(409);
    });
  });

  describe('DELETE /api/sandboxes/:id', () => {
    it('destroys a sandbox', async () => {
      mockSandboxService.get.mockReturnValueOnce({ id: 'sb-1' });
      mockSandboxService.destroy.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/sandboxes/sb-1',
      });

      expect(response.statusCode).toBe(204);
    });

    it('returns 404 for unknown sandbox', async () => {
      mockSandboxService.get.mockReturnValueOnce(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/sandboxes/nonexistent',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
