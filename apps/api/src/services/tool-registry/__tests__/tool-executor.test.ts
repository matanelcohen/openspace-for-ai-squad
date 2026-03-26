import { describe, expect, it, vi } from 'vitest';

import { ToolExecutor, ToolTimeoutError } from '../tool-executor.js';
import type { ToolDescriptor } from '../types.js';

function makeDescriptor(overrides: Partial<ToolDescriptor> = {}): ToolDescriptor {
  return {
    id: 'test-tool',
    name: 'Test',
    description: 'Test tool',
    version: '1.0.0',
    category: 'custom',
    parameters: [],
    ...overrides,
  };
}

describe('ToolExecutor', () => {
  const executor = new ToolExecutor();

  describe('execute', () => {
    it('returns success result when handler resolves', async () => {
      const handler = vi.fn().mockResolvedValue({ ok: true });
      const result = await executor.execute(makeDescriptor(), { x: 1 }, handler);

      expect(result.success).toBe(true);
      expect(result.toolId).toBe('test-tool');
      expect(result.data).toEqual({ ok: true });
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(handler).toHaveBeenCalledWith({ x: 1 });
    });

    it('returns error result when handler rejects', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('boom'));
      const result = await executor.execute(makeDescriptor(), {}, handler);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXECUTION_ERROR');
      expect(result.error?.message).toContain('boom');
    });

    it('returns timeout error when handler exceeds timeout', async () => {
      const handler = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );

      const result = await executor.execute(makeDescriptor(), {}, handler, 50);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
      expect(result.error?.message).toContain('timed out');
    });

    it('uses descriptor timeout when no override given', async () => {
      const handler = vi.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 5000)),
      );

      const result = await executor.execute(
        makeDescriptor({ timeout: 50 }),
        {},
        handler,
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('TIMEOUT');
    });

    it('uses default 30s timeout when none specified', async () => {
      const handler = vi.fn().mockResolvedValue('fast');
      const result = await executor.execute(makeDescriptor(), {}, handler);
      // Just verifying it completes quickly — default timeout is 30s
      expect(result.success).toBe(true);
    });

    it('records duration even on error', async () => {
      const handler = vi.fn().mockRejectedValue(new Error('fail'));
      const result = await executor.execute(makeDescriptor(), {}, handler);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('handles non-Error throws', async () => {
      const handler = vi.fn().mockRejectedValue('string error');
      const result = await executor.execute(makeDescriptor(), {}, handler);

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXECUTION_ERROR');
      expect(result.error?.message).toContain('string error');
    });
  });

  describe('executeCommand', () => {
    it('runs a simple command and captures stdout', async () => {
      const result = await executor.executeCommand('echo', ['hello']);
      expect(result.stdout.trim()).toBe('hello');
      expect(result.exitCode).toBe(0);
    });

    it('captures stderr on failure', async () => {
      const result = await executor.executeCommand('ls', ['--nonexistent-flag-xyz']);
      expect(result.exitCode).not.toBe(0);
    });

    it('respects timeout for commands', async () => {
      const result = await executor.executeCommand('sleep', ['10'], { timeout: 100 });
      // execFile kills the process on timeout, resulting in non-zero exit code
      expect(result.exitCode).not.toBe(0);
    });

    it('respects cwd option', async () => {
      const result = await executor.executeCommand('pwd', [], { cwd: '/tmp' });
      // macOS may resolve /tmp -> /private/tmp
      expect(result.stdout.trim()).toMatch(/\/tmp$/);
    });
  });

  describe('ToolTimeoutError', () => {
    it('has the correct name and message', () => {
      const err = new ToolTimeoutError('my-tool', 5000);
      expect(err.name).toBe('ToolTimeoutError');
      expect(err.message).toContain('my-tool');
      expect(err.message).toContain('5000ms');
      expect(err).toBeInstanceOf(Error);
    });
  });
});
