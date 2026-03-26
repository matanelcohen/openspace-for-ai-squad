/**
 * Sandboxed tool execution with timeout and error handling.
 */

import { execFile } from 'node:child_process';

import type { ToolDescriptor, ToolError, ToolResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_OUTPUT_BYTES = 1_048_576; // 1 MB

export class ToolExecutor {
  /**
   * Execute a tool handler function with timeout and error isolation.
   */
  async execute(
    descriptor: ToolDescriptor,
    params: Record<string, unknown>,
    handler: (params: Record<string, unknown>) => Promise<unknown>,
    timeoutOverride?: number,
  ): Promise<ToolResult> {
    const timeout = timeoutOverride ?? descriptor.timeout ?? DEFAULT_TIMEOUT_MS;
    const start = performance.now();

    try {
      const data = await this.withTimeout(handler(params), timeout, descriptor.id);
      return {
        toolId: descriptor.id,
        success: true,
        data,
        durationMs: Math.round(performance.now() - start),
      };
    } catch (err) {
      return {
        toolId: descriptor.id,
        success: false,
        error: this.toToolError(err, descriptor.id),
        durationMs: Math.round(performance.now() - start),
      };
    }
  }

  /**
   * Execute a shell command in a sandboxed child process.
   * Used by adapters that need to run CLI tools (git, grep, etc).
   */
  executeCommand(
    command: string,
    args: string[],
    options: { cwd?: string; timeout?: number; env?: Record<string, string> } = {},
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    return new Promise((resolve, reject) => {
      const child = execFile(
        command,
        args,
        {
          cwd: options.cwd ?? process.cwd(),
          timeout,
          maxBuffer: MAX_OUTPUT_BYTES,
          env: { ...process.env, ...options.env },
        },
        (error, stdout, stderr) => {
          if (error && !('code' in error)) {
            reject(error);
            return;
          }
          resolve({
            stdout: typeof stdout === 'string' ? stdout : '',
            stderr: typeof stderr === 'string' ? stderr : '',
            exitCode: child.exitCode ?? (error ? 1 : 0),
          });
        },
      );
    });
  }

  // ── Private ─────────────────────────────────────────────────────

  private withTimeout<T>(promise: Promise<T>, ms: number, toolId: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new ToolTimeoutError(toolId, ms));
      }, ms);

      promise
        .then((value) => {
          clearTimeout(timer);
          resolve(value);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }

  private toToolError(err: unknown, toolId: string): ToolError {
    if (err instanceof ToolTimeoutError) {
      return { code: 'TIMEOUT', message: err.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { code: 'EXECUTION_ERROR', message: `Tool "${toolId}" failed: ${message}` };
  }
}

export class ToolTimeoutError extends Error {
  constructor(toolId: string, timeoutMs: number) {
    super(`Tool "${toolId}" timed out after ${timeoutMs}ms`);
    this.name = 'ToolTimeoutError';
  }
}
