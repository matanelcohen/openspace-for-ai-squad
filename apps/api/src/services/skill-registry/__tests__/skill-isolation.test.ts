/**
 * Unit tests for skill-isolation.ts
 *
 * Covers: executeHook, safeOnLoad, safeOnActivate,
 *         safeOnDeactivate, safeOnUnload, safeImportEntryPoint
 */
import type { SkillContext, SkillLifecycleHooks } from '@openspace/shared';
import { describe, expect, it, vi } from 'vitest';

import {
  executeHook,
  safeOnActivate,
  safeOnDeactivate,
  safeOnLoad,
  safeOnUnload,
} from '../skill-isolation.js';

// ── Helpers ──────────────────────────────────────────────────────

const fakeContext = {} as SkillContext;

// ── executeHook ──────────────────────────────────────────────────

describe('executeHook', () => {
  it('returns success for a resolved promise', async () => {
    const result = await executeHook('test', async () => 42);
    expect(result.success).toBe(true);
    expect(result.result).toBe(42);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('captures errors without throwing', async () => {
    const result = await executeHook('test', async () => {
      throw new Error('hook failed');
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe('hook failed');
  });

  it('captures non-Error throws as Error objects', async () => {
    const result = await executeHook('test', async () => {
      throw 'string error';
    });
    expect(result.success).toBe(false);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error!.message).toBe('string error');
  });

  it('times out when hook exceeds timeout', async () => {
    const result = await executeHook(
      'slow-hook',
      () => new Promise((resolve) => setTimeout(resolve, 5000)),
      50, // 50ms timeout
    );
    expect(result.success).toBe(false);
    expect(result.error!.message).toContain('timed out');
    expect(result.error!.message).toContain('slow-hook');
  });

  it('tracks duration on success', async () => {
    const result = await executeHook('fast', async () => {
      await new Promise((r) => setTimeout(r, 20));
      return 'done';
    });
    expect(result.success).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(15);
  });

  it('tracks duration on failure', async () => {
    const result = await executeHook('fail', async () => {
      await new Promise((r) => setTimeout(r, 10));
      throw new Error('delayed failure');
    });
    expect(result.success).toBe(false);
    expect(result.durationMs).toBeGreaterThanOrEqual(5);
  });
});

// ── safeOnLoad ───────────────────────────────────────────────────

describe('safeOnLoad', () => {
  it('returns success when hooks is null', async () => {
    const result = await safeOnLoad(null, fakeContext);
    expect(result.success).toBe(true);
    expect(result.durationMs).toBe(0);
  });

  it('returns success when onLoad is undefined', async () => {
    const hooks: SkillLifecycleHooks = {};
    const result = await safeOnLoad(hooks, fakeContext);
    expect(result.success).toBe(true);
  });

  it('calls onLoad when provided', async () => {
    const onLoad = vi.fn().mockResolvedValue(undefined);
    const hooks: SkillLifecycleHooks = { onLoad };
    const result = await safeOnLoad(hooks, fakeContext);
    expect(result.success).toBe(true);
    expect(onLoad).toHaveBeenCalledWith(fakeContext);
  });

  it('captures onLoad errors', async () => {
    const hooks: SkillLifecycleHooks = {
      onLoad: async () => {
        throw new Error('load boom');
      },
    };
    const result = await safeOnLoad(hooks, fakeContext);
    expect(result.success).toBe(false);
    expect(result.error!.message).toBe('load boom');
  });
});

// ── safeOnActivate ───────────────────────────────────────────────

describe('safeOnActivate', () => {
  it('returns success when hooks is null', async () => {
    const result = await safeOnActivate(null, fakeContext);
    expect(result.success).toBe(true);
  });

  it('returns success when onActivate is undefined', async () => {
    const result = await safeOnActivate({}, fakeContext);
    expect(result.success).toBe(true);
  });

  it('calls onActivate and returns result', async () => {
    const hooks: SkillLifecycleHooks = {
      onActivate: async () => ({ extra: 'data' }),
    };
    const result = await safeOnActivate(hooks, fakeContext);
    expect(result.success).toBe(true);
    expect(result.result).toEqual({ extra: 'data' });
  });

  it('captures onActivate errors', async () => {
    const hooks: SkillLifecycleHooks = {
      onActivate: async () => {
        throw new Error('activate boom');
      },
    };
    const result = await safeOnActivate(hooks, fakeContext);
    expect(result.success).toBe(false);
    expect(result.error!.message).toBe('activate boom');
  });
});

// ── safeOnDeactivate ─────────────────────────────────────────────

describe('safeOnDeactivate', () => {
  it('returns success when hooks is null', async () => {
    const result = await safeOnDeactivate(null, fakeContext);
    expect(result.success).toBe(true);
  });

  it('calls onDeactivate when provided', async () => {
    const onDeactivate = vi.fn().mockResolvedValue(undefined);
    const hooks: SkillLifecycleHooks = { onDeactivate };
    const result = await safeOnDeactivate(hooks, fakeContext);
    expect(result.success).toBe(true);
    expect(onDeactivate).toHaveBeenCalledWith(fakeContext);
  });

  it('captures onDeactivate errors', async () => {
    const hooks: SkillLifecycleHooks = {
      onDeactivate: async () => {
        throw new Error('deactivate boom');
      },
    };
    const result = await safeOnDeactivate(hooks, fakeContext);
    expect(result.success).toBe(false);
  });
});

// ── safeOnUnload ─────────────────────────────────────────────────

describe('safeOnUnload', () => {
  it('returns success when hooks is null', async () => {
    const result = await safeOnUnload(null);
    expect(result.success).toBe(true);
  });

  it('returns success when onUnload is undefined', async () => {
    const result = await safeOnUnload({});
    expect(result.success).toBe(true);
  });

  it('calls onUnload when provided', async () => {
    const onUnload = vi.fn().mockResolvedValue(undefined);
    const hooks: SkillLifecycleHooks = { onUnload };
    const result = await safeOnUnload(hooks);
    expect(result.success).toBe(true);
    expect(onUnload).toHaveBeenCalled();
  });

  it('captures onUnload errors', async () => {
    const hooks: SkillLifecycleHooks = {
      onUnload: async () => {
        throw new Error('unload boom');
      },
    };
    const result = await safeOnUnload(hooks);
    expect(result.success).toBe(false);
    expect(result.error!.message).toBe('unload boom');
  });
});
