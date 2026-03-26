/**
 * ContainerManager unit tests.
 *
 * These tests mock dockerode to avoid requiring a real Docker daemon.
 */

import { PassThrough } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContainerManager } from '../container-manager.js';

// ── Mock helpers ──────────────────────────────────────────────────

function createMockDocker() {
  const mockContainer = {
    id: 'container-abc123',
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    inspect: vi.fn().mockResolvedValue({ State: { Running: true } }),
    exec: vi.fn(),
    getArchive: vi.fn(),
    modem: {
      demuxStream: vi.fn((stream: PassThrough, stdout: PassThrough, _stderr: PassThrough) => {
        // Simulate demuxing: pipe directly to stdout
        stream.pipe(stdout);
      }),
    },
  };

  const docker = {
    createContainer: vi.fn().mockResolvedValue(mockContainer),
    getContainer: vi.fn().mockReturnValue(mockContainer),
    pull: vi.fn(
      (_image: string, cb: (err: Error | null, stream: NodeJS.ReadableStream) => void) => {
        const stream = new PassThrough();
        cb(null, stream);
        stream.end();
      },
    ),
    modem: {
      followProgress: vi.fn((_stream: NodeJS.ReadableStream, cb: (err: Error | null) => void) => {
        cb(null);
      }),
      demuxStream: mockContainer.modem.demuxStream,
    },
  };

  return { docker, mockContainer };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('ContainerManager', () => {
  let manager: ContainerManager;
  let mockDocker: ReturnType<typeof createMockDocker>['docker'];
  let mockContainer: ReturnType<typeof createMockDocker>['mockContainer'];

  beforeEach(() => {
    const mocks = createMockDocker();
    mockDocker = mocks.docker;
    mockContainer = mocks.mockContainer;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    manager = new ContainerManager(mockDocker as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('creates and starts a container with correct config', async () => {
      const containerId = await manager.create({ runtime: 'node' });

      expect(containerId).toBe('container-abc123');
      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'node:22-slim',
          Cmd: ['sleep', 'infinity'],
          WorkingDir: '/workspace',
          HostConfig: expect.objectContaining({
            NetworkMode: 'none',
            SecurityOpt: ['no-new-privileges'],
          }),
          Labels: {
            'openspace.sandbox': 'true',
            'openspace.runtime': 'node',
          },
        }),
      );
      expect(mockContainer.start).toHaveBeenCalled();
    });

    it('uses correct image for python runtime', async () => {
      await manager.create({ runtime: 'python' });

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'python:3.12-slim',
        }),
      );
    });

    it('uses correct image for go runtime', async () => {
      await manager.create({ runtime: 'go' });

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Image: 'golang:1.22-alpine',
        }),
      );
    });

    it('applies custom resource limits', async () => {
      await manager.create({
        runtime: 'node',
        limits: { cpuShares: 512, memoryBytes: 256 * 1024 * 1024 },
      });

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          HostConfig: expect.objectContaining({
            CpuShares: 512,
            Memory: 256 * 1024 * 1024,
          }),
        }),
      );
    });

    it('passes environment variables', async () => {
      await manager.create({
        runtime: 'node',
        env: { NODE_ENV: 'test', FOO: 'bar' },
      });

      expect(mockDocker.createContainer).toHaveBeenCalledWith(
        expect.objectContaining({
          Env: ['NODE_ENV=test', 'FOO=bar'],
        }),
      );
    });
  });

  describe('exec', () => {
    it('executes a command and returns result', async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };
      mockContainer.exec.mockResolvedValue(mockExec);

      // Simulate output then end
      setTimeout(() => {
        mockStream.write('hello world\n');
        mockStream.end();
      }, 10);

      const result = await manager.exec('container-abc123', {
        command: 'echo hello world',
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('hello world');
      expect(result.timedOut).toBe(false);
      expect(result.execId).toBeDefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('emits stream:data events', async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };
      mockContainer.exec.mockResolvedValue(mockExec);

      const chunks: unknown[] = [];
      manager.on('stream:data', (chunk) => chunks.push(chunk));

      setTimeout(() => {
        mockStream.write('output');
        mockStream.end();
      }, 10);

      await manager.exec('container-abc123', { command: 'echo output' });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toMatchObject({
        stream: 'stdout',
        data: expect.stringContaining('output'),
      });
    });

    it('emits stream:end event', async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ ExitCode: 0 }),
      };
      mockContainer.exec.mockResolvedValue(mockExec);

      const ends: unknown[] = [];
      manager.on('stream:end', (end) => ends.push(end));

      setTimeout(() => mockStream.end(), 10);

      await manager.exec('container-abc123', { command: 'true' });

      expect(ends.length).toBe(1);
      expect(ends[0]).toMatchObject({
        exitCode: 0,
        timedOut: false,
      });
    });

    it('handles timeout', async () => {
      const mockStream = new PassThrough();
      const mockExec = {
        start: vi.fn().mockResolvedValue(mockStream),
        inspect: vi.fn().mockResolvedValue({ ExitCode: -1 }),
      };
      mockContainer.exec.mockResolvedValue(mockExec);

      // Don't end the stream — let it timeout
      const result = await manager.exec('container-abc123', {
        command: 'sleep 1000',
        timeoutMs: 50,
      });

      expect(result.timedOut).toBe(true);
      expect(result.exitCode).toBe(-1);
    });
  });

  describe('destroy', () => {
    it('stops and removes the container', async () => {
      await manager.destroy('container-abc123');

      expect(mockContainer.stop).toHaveBeenCalledWith({ t: 2 });
      expect(mockContainer.remove).toHaveBeenCalledWith({ force: true });
    });

    it('handles already-stopped container gracefully', async () => {
      mockContainer.stop.mockRejectedValue(new Error('already stopped'));

      await expect(manager.destroy('container-abc123')).resolves.toBeUndefined();
      expect(mockContainer.remove).toHaveBeenCalled();
    });
  });

  describe('isRunning', () => {
    it('returns true for running container', async () => {
      const result = await manager.isRunning('container-abc123');
      expect(result).toBe(true);
    });

    it('returns false for stopped container', async () => {
      mockContainer.inspect.mockResolvedValue({ State: { Running: false } });
      const result = await manager.isRunning('container-abc123');
      expect(result).toBe(false);
    });

    it('returns false when container does not exist', async () => {
      mockContainer.inspect.mockRejectedValue(new Error('no such container'));
      const result = await manager.isRunning('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('copyFrom', () => {
    it('returns tar buffer from container', async () => {
      const mockStream = new PassThrough();
      mockContainer.getArchive.mockResolvedValue(mockStream);

      setTimeout(() => {
        mockStream.write(Buffer.from('tar-data'));
        mockStream.end();
      }, 10);

      const result = await manager.copyFrom('container-abc123', '/workspace/output');
      expect(result.toString()).toBe('tar-data');
    });
  });
});
