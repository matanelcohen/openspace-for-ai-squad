/**
 * Custom Tool Provider — executes config-driven custom tools.
 *
 * Handles three execution modes:
 * - rest-api: Makes HTTP requests
 * - cli-command: Runs shell commands
 * - file-processor: Reads/writes/transforms/globs files
 */

import { exec } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { BaseToolProvider } from './plugin-interface.js';
import type {
  CliCommandExecution,
  CustomToolDescriptor,
  CustomToolExecution,
  FileProcessorExecution,
  RestApiExecution,
  ToolDescriptor,
} from './types.js';

const DEFAULT_TIMEOUT = 30_000;
const MAX_OUTPUT_BYTES = 1_048_576; // 1 MB

export class CustomToolProvider extends BaseToolProvider {
  readonly name = 'custom-tools';
  private readonly customTools = new Map<string, CustomToolDescriptor>();

  getTools(): ToolDescriptor[] {
    return [...this.customTools.values()];
  }

  /** Add a custom tool to this provider. */
  addTool(descriptor: CustomToolDescriptor): void {
    this.customTools.set(descriptor.id, descriptor);
  }

  /** Remove a custom tool from this provider. */
  removeTool(toolId: string): boolean {
    return this.customTools.delete(toolId);
  }

  /** Check if a custom tool exists. */
  hasTool(toolId: string): boolean {
    return this.customTools.has(toolId);
  }

  /** Get a custom tool descriptor. */
  getCustomTool(toolId: string): CustomToolDescriptor | undefined {
    return this.customTools.get(toolId);
  }

  /** Get all custom tool descriptors. */
  getAllCustomTools(): CustomToolDescriptor[] {
    return [...this.customTools.values()];
  }

  /** Clear all tools. */
  clear(): void {
    this.customTools.clear();
  }

  async execute(toolId: string, params: Record<string, unknown>): Promise<unknown> {
    const descriptor = this.customTools.get(toolId);
    if (!descriptor) {
      throw new Error(`Custom tool "${toolId}" not found in provider`);
    }

    switch (descriptor.execution.mode) {
      case 'rest-api':
        return this.executeRestApi(descriptor.execution, params);
      case 'cli-command':
        return this.executeCliCommand(descriptor.execution, params);
      case 'file-processor':
        return this.executeFileProcessor(descriptor.execution, params);
      default:
        throw new Error(`Unknown execution mode: ${(descriptor.execution as CustomToolExecution).mode}`);
    }
  }

  // ── REST API ─────────────────────────────────────────────────

  private async executeRestApi(
    config: RestApiExecution,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const url = (params.url as string) ?? config.url;
    const method = config.method;
    const headers = { ...config.headers };

    let body: string | undefined;
    if (config.bodyTemplate) {
      body = substituteParams(config.bodyTemplate, params);
    } else if (params.body != null) {
      body = JSON.stringify(params.body);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body && method !== 'GET' ? body : undefined,
        signal: controller.signal,
      });

      const contentType = response.headers.get('content-type') ?? '';
      let responseBody: unknown;
      if (contentType.includes('application/json')) {
        responseBody = await response.json();
      } else {
        responseBody = await response.text();
      }

      // Apply response transform if specified
      if (config.responseTransform && typeof responseBody === 'object' && responseBody !== null) {
        responseBody = extractPath(responseBody, config.responseTransform);
      }

      return {
        status: response.status,
        statusText: response.statusText,
        body: responseBody,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // ── CLI Command ──────────────────────────────────────────────

  private executeCliCommand(
    config: CliCommandExecution,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    return new Promise((resolve_promise, reject) => {
      const args = (config.args ?? []).map((arg) => substituteParams(arg, params));
      const fullCommand = [config.command, ...args].join(' ');
      const timeout = DEFAULT_TIMEOUT;

      const child = exec(fullCommand, {
        cwd: config.cwd ?? process.cwd(),
        timeout,
        maxBuffer: MAX_OUTPUT_BYTES,
        env: { ...process.env, ...config.env },
      }, (error, stdout, stderr) => {
        const output = typeof stdout === 'string' ? stdout : '';
        const errOutput = typeof stderr === 'string' ? stderr : '';
        const exitCode = child.exitCode ?? (error ? 1 : 0);

        let parsed: unknown = output;
        if (config.parseOutput === 'json') {
          try {
            parsed = JSON.parse(output);
          } catch {
            parsed = output;
          }
        } else if (config.parseOutput === 'lines') {
          parsed = output.split('\n').filter((l) => l.length > 0);
        }

        if (exitCode !== 0 && error && !stdout) {
          reject(new Error(`Command failed (exit ${exitCode}): ${errOutput || error.message}`));
          return;
        }

        resolve_promise({
          exitCode,
          stdout: parsed,
          stderr: errOutput,
        });
      });
    });
  }

  // ── File Processor ───────────────────────────────────────────

  private async executeFileProcessor(
    config: FileProcessorExecution,
    params: Record<string, unknown>,
  ): Promise<unknown> {
    const basePath = config.basePath ?? process.cwd();
    const filePath = params.path ? resolve(basePath, params.path as string) : undefined;

    switch (config.operation) {
      case 'read': {
        if (!filePath) throw new Error('File processor "read" requires a "path" parameter');
        const content = await readFile(filePath, 'utf-8');
        return { path: filePath, content, size: content.length };
      }

      case 'write': {
        if (!filePath) throw new Error('File processor "write" requires a "path" parameter');
        const content = params.content as string;
        if (content == null) throw new Error('File processor "write" requires a "content" parameter');
        await writeFile(filePath, content, 'utf-8');
        return { path: filePath, written: true, size: content.length };
      }

      case 'transform': {
        if (!filePath) throw new Error('File processor "transform" requires a "path" parameter');
        if (!config.transformScript) throw new Error('File processor "transform" requires a "transformScript"');
        const source = await readFile(filePath, 'utf-8');
        // Safe transform: only allows string manipulation
        const fn = new Function('content', 'params', config.transformScript) as (
          content: string,
          params: Record<string, unknown>,
        ) => string;
        const result = fn(source, params);
        return { path: filePath, original: source, transformed: result };
      }

      case 'glob': {
        const { glob } = await import('node:fs');
        const { promisify } = await import('node:util');
        const globAsync = promisify(glob);
        const pattern = config.pattern ?? (params.pattern as string) ?? '*';
        const files = await globAsync(pattern, { cwd: basePath });
        return { basePath, pattern, files };
      }

      default:
        throw new Error(`Unknown file processor operation: ${config.operation}`);
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/** Replace {{param}} placeholders with actual values. */
export function substituteParams(template: string, params: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = params[key];
    return value != null ? String(value) : '';
  });
}

/** Extract a nested value from an object using dot-notation path. */
export function extractPath(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
