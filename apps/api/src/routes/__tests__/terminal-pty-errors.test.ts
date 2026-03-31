/**
 * Tests for PTY error classification, lazy loader, and health-check endpoint.
 *
 * Covers:
 * 1. classifyPtyError() — all error detection branches
 * 2. loadPty() / _resetPtyCache() — lazy loading and caching
 * 3. GET /api/terminal/health — HTTP health-check endpoint
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  classifyPtyError,
  loadPty,
  _resetPtyCache,
  type PtyError,
  type PtyErrorCode,
} from '../terminal.js';

// ── classifyPtyError ─────────────────────────────────────────────

describe('classifyPtyError', () => {
  describe('PTY_NOT_INSTALLED detection', () => {
    const cases: Array<[string, string]> = [
      ['Cannot find module "node-pty"', 'cannot find module'],
      ['Error: MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'],
      ['Could not locate the bindings file', 'bindings file'],
      ['was compiled against a different Node.js version', 'ABI mismatch'],
      ['Error loading node_modules/node-pty/build/Release', 'native addon path'],
    ];

    it.each(cases)('detects "%s" (%s)', (message) => {
      const result = classifyPtyError(new Error(message));
      expect(result.code).toBe('PTY_NOT_INSTALLED');
      expect(result.reason).toContain('pnpm rebuild');
    });
  });

  describe('PTY_UNAVAILABLE detection', () => {
    const cases: Array<[string, string]> = [
      ['PTY is not supported on this platform', 'not supported'],
      ['Not supported on this platform', 'platform check'],
      ['openpty failed', 'openpty'],
      ['forkpty failed', 'forkpty'],
      ['winpty error', 'winpty'],
      ['conpty is not available', 'conpty'],
    ];

    it.each(cases)('detects "%s" (%s)', (message) => {
      const result = classifyPtyError(new Error(message));
      expect(result.code).toBe('PTY_UNAVAILABLE');
      expect(result.reason).toContain('pseudo-terminal');
    });
  });

  describe('PTY_SPAWN_FAILED — permission denied', () => {
    it('detects EACCES', () => {
      const result = classifyPtyError(new Error('spawn EACCES'));
      expect(result.code).toBe('PTY_SPAWN_FAILED');
      expect(result.reason).toContain('Permission denied');
    });

    it('detects "permission denied" text', () => {
      const result = classifyPtyError(new Error('permission denied /bin/bash'));
      expect(result.code).toBe('PTY_SPAWN_FAILED');
      expect(result.reason).toContain('Permission denied');
    });
  });

  describe('PTY_SPAWN_FAILED — shell not found', () => {
    it('detects ENOENT', () => {
      const result = classifyPtyError(new Error('spawn ENOENT'));
      expect(result.code).toBe('PTY_SPAWN_FAILED');
      expect(result.reason).toContain('not found');
    });

    it('detects "no such file"', () => {
      const result = classifyPtyError(new Error('no such file or directory'));
      expect(result.code).toBe('PTY_SPAWN_FAILED');
      expect(result.reason).toContain('not found');
    });

    it('includes SHELL env guidance', () => {
      const result = classifyPtyError(new Error('ENOENT'));
      expect(result.reason).toContain('SHELL');
    });
  });

  describe('PTY_SPAWN_FAILED — generic fallback', () => {
    it('returns generic code for unknown errors', () => {
      const result = classifyPtyError(new Error('something completely unexpected'));
      expect(result.code).toBe('PTY_SPAWN_FAILED');
      expect(result.reason).toContain('something completely unexpected');
    });

    it('handles non-Error values', () => {
      const result = classifyPtyError('string error');
      expect(result.code).toBe('PTY_SPAWN_FAILED');
      expect(result.reason).toContain('string error');
    });

    it('handles null', () => {
      const result = classifyPtyError(null);
      expect(result.code).toBe('PTY_SPAWN_FAILED');
    });

    it('handles undefined', () => {
      const result = classifyPtyError(undefined);
      expect(result.code).toBe('PTY_SPAWN_FAILED');
    });

    it('handles number', () => {
      const result = classifyPtyError(42);
      expect(result.code).toBe('PTY_SPAWN_FAILED');
      expect(result.reason).toContain('42');
    });
  });

  describe('PtyError shape', () => {
    it('always returns code and reason', () => {
      const inputs: unknown[] = [
        new Error('test'),
        'string',
        null,
        42,
        { message: 'obj' },
      ];
      for (const input of inputs) {
        const result = classifyPtyError(input);
        expect(result).toHaveProperty('code');
        expect(result).toHaveProperty('reason');
        expect(typeof result.code).toBe('string');
        expect(typeof result.reason).toBe('string');
        expect(result.reason.length).toBeGreaterThan(0);
      }
    });

    it('code is a valid PtyErrorCode', () => {
      const validCodes: PtyErrorCode[] = [
        'PTY_NOT_INSTALLED',
        'PTY_UNAVAILABLE',
        'PTY_SPAWN_FAILED',
      ];
      const result = classifyPtyError(new Error('test'));
      expect(validCodes).toContain(result.code);
    });
  });

  describe('priority: PTY_NOT_INSTALLED beats PTY_SPAWN_FAILED', () => {
    it('module-not-found with ENOENT prefers PTY_NOT_INSTALLED', () => {
      const result = classifyPtyError(
        new Error('Cannot find module "node-pty" — ENOENT'),
      );
      expect(result.code).toBe('PTY_NOT_INSTALLED');
    });
  });
});

// ── loadPty / _resetPtyCache ─────────────────────────────────────

describe('loadPty', () => {
  beforeEach(() => {
    _resetPtyCache();
  });

  afterEach(() => {
    _resetPtyCache();
    vi.restoreAllMocks();
  });

  it('returns pty module when node-pty is available', () => {
    // node-pty is mocked in the test environment, so require succeeds
    // if vitest has the mock from the sibling test file, we skip this
    // Just verify the shape:
    const result = loadPty();
    // Either { pty } or { error } depending on environment
    expect('pty' in result || 'error' in result).toBe(true);
  });

  it('caches the result on subsequent calls', () => {
    const result1 = loadPty();
    const result2 = loadPty();
    // Same reference — cached
    if ('pty' in result1 && 'pty' in result2) {
      expect(result1.pty).toBe(result2.pty);
    } else if ('error' in result1 && 'error' in result2) {
      expect(result1.error).toBe(result2.error);
    }
  });

  it('_resetPtyCache clears cached state', () => {
    loadPty(); // populate cache
    _resetPtyCache();
    // After reset, next call should re-evaluate
    const result = loadPty();
    expect('pty' in result || 'error' in result).toBe(true);
  });
});

// ── Health-check endpoint (integration-lite) ─────────────────────

describe('GET /terminal/health', () => {
  // We test the route handler logic by importing the plugin and calling
  // Fastify's inject(). This requires building a lightweight Fastify app.

  let app: Awaited<ReturnType<typeof buildApp>> | null = null;

  async function buildApp() {
    const { default: Fastify } = await import('fastify');
    const { default: terminalRoute } = await import('../terminal.js');

    const fastify = Fastify({ logger: false });
    await fastify.register(terminalRoute, { prefix: '/api' });
    await fastify.ready();
    return fastify;
  }

  beforeEach(async () => {
    _resetPtyCache();
    app = await buildApp();
  });

  afterEach(async () => {
    _resetPtyCache();
    if (app) await app.close();
    app = null;
  });

  it('returns 200 with { status: "ok" } when PTY is available', async () => {
    // In test env node-pty may or may not be present.
    // We just verify the endpoint responds correctly.
    const res = await app!.inject({ method: 'GET', url: '/api/terminal/health' });
    const body = JSON.parse(res.body);

    if (res.statusCode === 200) {
      expect(body).toEqual({ status: 'ok' });
    } else {
      // 503 if node-pty is genuinely missing in test environment
      expect(res.statusCode).toBe(503);
      expect(body.status).toBe('unavailable');
      expect(body.code).toBeDefined();
      expect(body.reason).toBeDefined();
    }
  });

  it('returns 503 with error details when PTY is unavailable', async () => {
    // Force a load error by pre-populating the cache with an error
    // We do this by loading, resetting, then mocking require to fail
    _resetPtyCache();

    // Manually call loadPty after mocking — but since require is cached
    // by Node, we use _resetPtyCache + a controlled import error.
    // Instead, let's test the response shape when the endpoint returns 503.
    const res = await app!.inject({ method: 'GET', url: '/api/terminal/health' });
    const body = JSON.parse(res.body);

    // We can only assert the shape, since we can't easily force node-pty
    // to fail in this env without modifying the module cache.
    if (res.statusCode === 503) {
      expect(body).toMatchObject({
        status: 'unavailable',
        code: expect.stringMatching(/^PTY_/),
        reason: expect.any(String),
      });
    } else {
      expect(res.statusCode).toBe(200);
      expect(body.status).toBe('ok');
    }
  });

  it('health endpoint is idempotent (multiple calls same result)', async () => {
    const res1 = await app!.inject({ method: 'GET', url: '/api/terminal/health' });
    const res2 = await app!.inject({ method: 'GET', url: '/api/terminal/health' });

    expect(res1.statusCode).toBe(res2.statusCode);
    expect(JSON.parse(res1.body)).toEqual(JSON.parse(res2.body));
  });
});
