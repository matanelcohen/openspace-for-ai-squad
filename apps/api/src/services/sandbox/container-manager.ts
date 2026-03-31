/**
 * ContainerManager — Docker container lifecycle management.
 *
 * Wraps dockerode to provide create / exec / destroy / copyFrom operations
 * with resource limits, timeout enforcement, and streaming support.
 */

import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';

import Docker from 'dockerode';
import { nanoid } from 'nanoid';

import {
  DEFAULT_RESOURCE_LIMITS,
  type ExecRequest,
  type ExecResult,
  type ResourceLimits,
  RUNTIME_IMAGES,
  type SandboxRuntime,
  type StreamChunk,
  type StreamEnd,
} from './types.js';

export interface ContainerCreateOptions {
  runtime: SandboxRuntime;
  limits?: ResourceLimits;
  env?: Record<string, string>;
}

export class ContainerManager extends EventEmitter {
  private docker: Docker;

  constructor(docker?: Docker) {
    super();
    this.docker = docker ?? new Docker();
  }

  /**
   * Create and start a container for the given runtime.
   * Returns the container ID.
   */
  async create(opts: ContainerCreateOptions): Promise<string> {
    const image = RUNTIME_IMAGES[opts.runtime];
    const limits: Required<ResourceLimits> = {
      ...DEFAULT_RESOURCE_LIMITS,
      ...opts.limits,
    };

    const envArray = opts.env ? Object.entries(opts.env).map(([k, v]) => `${k}=${v}`) : [];

    // Pull image if not present (best-effort, may already be cached)
    try {
      await this.pullImage(image);
    } catch {
      // Image may already exist locally
    }

    const container = await this.docker.createContainer({
      Image: image,
      Cmd: ['sleep', 'infinity'],
      WorkingDir: '/workspace',
      Env: envArray,
      HostConfig: {
        CpuShares: limits.cpuShares,
        Memory: limits.memoryBytes,
        MemorySwap: limits.memoryBytes, // no swap
        NetworkMode: 'none', // sandboxed — no network
        SecurityOpt: ['no-new-privileges'],
        ReadonlyRootfs: false,
      },
      Labels: {
        'openspace.sandbox': 'true',
        'openspace.runtime': opts.runtime,
      },
    });

    await container.start();
    return container.id;
  }

  /**
   * Execute a command inside a running container.
   * Returns the full result after completion.
   */
  async exec(containerId: string, request: ExecRequest): Promise<ExecResult> {
    const execId = nanoid(12);
    const container = this.docker.getContainer(containerId);
    const timeoutMs = request.timeoutMs ?? DEFAULT_RESOURCE_LIMITS.timeoutMs;
    const workdir = request.workdir ?? '/workspace';

    const envArray = request.env ? Object.entries(request.env).map(([k, v]) => `${k}=${v}`) : [];

    const exec = await container.exec({
      Cmd: ['sh', '-c', request.command],
      WorkingDir: workdir,
      Env: envArray,
      AttachStdout: true,
      AttachStderr: true,
    });

    const start = Date.now();
    let timedOut = false;

    const stream = await exec.start({ hijack: true, stdin: false });

    const stdoutBuf: Buffer[] = [];
    const stderrBuf: Buffer[] = [];

    // dockerode multiplexes stdout/stderr on the same stream.
    // Use demuxStream to split them.
    const stdoutPass = new PassThrough();
    const stderrPass = new PassThrough();

    stdoutPass.on('data', (chunk: Buffer) => {
      stdoutBuf.push(chunk);
      this.emit('stream:data', {
        execId,
        stream: 'stdout',
        data: chunk.toString('utf-8'),
        timestamp: new Date().toISOString(),
      } satisfies StreamChunk);
    });

    stderrPass.on('data', (chunk: Buffer) => {
      stderrBuf.push(chunk);
      this.emit('stream:data', {
        execId,
        stream: 'stderr',
        data: chunk.toString('utf-8'),
        timestamp: new Date().toISOString(),
      } satisfies StreamChunk);
    });

    container.modem.demuxStream(stream, stdoutPass, stderrPass);

    // Timeout handling
    const timeoutPromise = new Promise<'timeout'>((resolve) => {
      setTimeout(() => resolve('timeout'), timeoutMs);
    });

    const streamEndPromise = new Promise<'done'>((resolve) => {
      stream.on('end', () => resolve('done'));
    });

    const result = await Promise.race([streamEndPromise, timeoutPromise]);

    if (result === 'timeout') {
      timedOut = true;
      stream.destroy();
    }

    // Get exit code
    let exitCode = -1;
    if (!timedOut) {
      try {
        const inspectResult = await exec.inspect();
        exitCode = inspectResult.ExitCode ?? -1;
      } catch {
        exitCode = -1;
      }
    }

    const durationMs = Date.now() - start;

    const execResult: ExecResult = {
      execId,
      exitCode,
      stdout: Buffer.concat(stdoutBuf).toString('utf-8'),
      stderr: Buffer.concat(stderrBuf).toString('utf-8'),
      timedOut,
      durationMs,
    };

    this.emit('stream:end', {
      execId,
      exitCode,
      timedOut,
      durationMs,
    } satisfies StreamEnd);

    return execResult;
  }

  /**
   * Copy a file or directory out of the container as a tar stream.
   * Returns a Buffer containing the tar archive.
   */
  async copyFrom(containerId: string, containerPath: string): Promise<Buffer> {
    const container = this.docker.getContainer(containerId);
    const stream = await container.getArchive({ path: containerPath });

    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  /**
   * Stop a running container (without removing it).
   */
  async stop(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.stop({ t: 5 });
  }

  /**
   * Restart a stopped container.
   */
  async restart(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    await container.start();
  }

  /**
   * Stop and remove a container.
   */
  async destroy(containerId: string): Promise<void> {
    const container = this.docker.getContainer(containerId);
    try {
      await container.stop({ t: 2 });
    } catch {
      // may already be stopped
    }
    try {
      await container.remove({ force: true });
    } catch {
      // may already be removed
    }
  }

  /**
   * Check if a container is running.
   */
  async isRunning(containerId: string): Promise<boolean> {
    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();
      return info.State?.Running === true;
    } catch {
      return false;
    }
  }

  /**
   * Pull a Docker image. Resolves when the pull is complete.
   */
  private pullImage(image: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.docker.pull(image, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) return reject(err);

        this.docker.modem.followProgress(stream, (followErr: Error | null) => {
          if (followErr) return reject(followErr);
          resolve();
        });
      });
    });
  }
}
