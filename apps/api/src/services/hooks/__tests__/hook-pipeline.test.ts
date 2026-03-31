import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { HookContext } from '../pipeline.js';
import {
  buildHookPipeline,
  createFileGuardHook,
  createRateLimitHook,
  createShellRestrictionHook,
  HookPipeline,
} from '../pipeline.js';

// ── Helpers ─────────────────────────────────────────────────────

function makeContext(overrides?: Partial<HookContext>): HookContext {
  return {
    agentId: 'agent-1',
    tool: 'bash',
    params: { command: 'echo hello' },
    ...overrides,
  };
}

// ── HookPipeline ────────────────────────────────────────────────

describe('HookPipeline', () => {
  let pipeline: HookPipeline;

  beforeEach(() => {
    pipeline = new HookPipeline();
  });

  it('allows execution with no hooks', async () => {
    const result = await pipeline.execute(makeContext());
    expect(result.allowed).toBe(true);
  });

  it('allows when all hooks return allow', async () => {
    pipeline.addPreHook(async () => ({ action: 'allow' }));
    pipeline.addPreHook(async () => ({ action: 'allow' }));

    const result = await pipeline.execute(makeContext());
    expect(result.allowed).toBe(true);
  });

  it('blocks on first blocking hook', async () => {
    pipeline.addPreHook(async () => ({ action: 'allow' }));
    pipeline.addPreHook(async () => ({ action: 'block', reason: 'Forbidden' }));
    pipeline.addPreHook(async () => ({ action: 'allow' }));

    const result = await pipeline.execute(makeContext());
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Forbidden');
  });

  it('continues execution when a hook throws', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    pipeline.addPreHook(async () => {
      throw new Error('Hook crashed');
    });
    pipeline.addPreHook(async () => ({ action: 'allow' }));

    const result = await pipeline.execute(makeContext());
    expect(result.allowed).toBe(true);

    spy.mockRestore();
  });

  it('runs hooks in order', async () => {
    const order: number[] = [];

    pipeline.addPreHook(async () => {
      order.push(1);
      return { action: 'allow' };
    });
    pipeline.addPreHook(async () => {
      order.push(2);
      return { action: 'allow' };
    });
    pipeline.addPreHook(async () => {
      order.push(3);
      return { action: 'allow' };
    });

    await pipeline.execute(makeContext());
    expect(order).toEqual([1, 2, 3]);
  });

  it('short-circuits on block (skips remaining hooks)', async () => {
    const order: number[] = [];

    pipeline.addPreHook(async () => {
      order.push(1);
      return { action: 'allow' };
    });
    pipeline.addPreHook(async () => {
      order.push(2);
      return { action: 'block', reason: 'stop' };
    });
    pipeline.addPreHook(async () => {
      order.push(3);
      return { action: 'allow' };
    });

    await pipeline.execute(makeContext());
    expect(order).toEqual([1, 2]);
  });
});

// ── FileGuard Hook ──────────────────────────────────────────────

describe('createFileGuardHook', () => {
  it('allows writes to allowed paths', async () => {
    const hook = createFileGuardHook(['src/**']);
    const result = await hook(
      makeContext({
        tool: 'edit',
        params: { path: 'src/index.ts' },
      }),
    );
    expect(result.action).toBe('allow');
  });

  it('blocks writes outside allowed paths', async () => {
    const hook = createFileGuardHook(['src/**']);
    const result = await hook(
      makeContext({
        tool: 'edit',
        params: { path: '/etc/passwd' },
      }),
    );
    expect(result.action).toBe('block');
    expect(result.reason).toContain('FileGuard');
    expect(result.reason).toContain('/etc/passwd');
  });

  it('allows non-writing tools regardless of path', async () => {
    const hook = createFileGuardHook(['src/**']);
    const result = await hook(
      makeContext({
        tool: 'bash',
        params: { command: 'cat /etc/passwd' },
      }),
    );
    expect(result.action).toBe('allow');
  });

  it('checks all writing tool names', async () => {
    const hook = createFileGuardHook(['src/**']);

    for (const tool of ['edit', 'create', 'write', 'file_write']) {
      const result = await hook(
        makeContext({
          tool,
          params: { path: '/root/secret.txt' },
        }),
      );
      expect(result.action).toBe('block');
    }
  });

  it('allows when no path is in params', async () => {
    const hook = createFileGuardHook(['src/**']);
    const result = await hook(
      makeContext({
        tool: 'edit',
        params: {},
      }),
    );
    expect(result.action).toBe('allow');
  });

  it('supports the file param key', async () => {
    const hook = createFileGuardHook(['src/**']);
    const result = await hook(
      makeContext({
        tool: 'edit',
        params: { file: '/etc/hosts' },
      }),
    );
    expect(result.action).toBe('block');
  });

  it('supports multiple allowed paths', async () => {
    const hook = createFileGuardHook(['src/**', 'tests/**']);

    const srcResult = await hook(
      makeContext({
        tool: 'edit',
        params: { path: 'src/foo.ts' },
      }),
    );
    expect(srcResult.action).toBe('allow');

    const testResult = await hook(
      makeContext({
        tool: 'edit',
        params: { path: 'tests/bar.test.ts' },
      }),
    );
    expect(testResult.action).toBe('allow');
  });

  it('supports ** glob for deep paths', async () => {
    const hook = createFileGuardHook(['packages/**']);
    const result = await hook(
      makeContext({
        tool: 'edit',
        params: { path: 'packages/shared/src/index.ts' },
      }),
    );
    expect(result.action).toBe('allow');
  });
});

// ── ShellRestriction Hook ───────────────────────────────────────

describe('createShellRestrictionHook', () => {
  it('blocks dangerous commands', async () => {
    const hook = createShellRestrictionHook(['rm -rf', 'sudo', 'chmod 777']);

    const result = await hook(
      makeContext({
        tool: 'bash',
        params: { command: 'sudo rm -rf /' },
      }),
    );
    expect(result.action).toBe('block');
    expect(result.reason).toContain('ShellRestriction');
  });

  it('allows safe commands', async () => {
    const hook = createShellRestrictionHook(['rm -rf', 'sudo']);

    const result = await hook(
      makeContext({
        tool: 'bash',
        params: { command: 'ls -la' },
      }),
    );
    expect(result.action).toBe('allow');
  });

  it('is case-insensitive', async () => {
    const hook = createShellRestrictionHook(['SUDO']);

    const result = await hook(
      makeContext({
        tool: 'bash',
        params: { command: 'sudo apt-get update' },
      }),
    );
    expect(result.action).toBe('block');
  });

  it('allows non-shell tools', async () => {
    const hook = createShellRestrictionHook(['rm -rf']);

    const result = await hook(
      makeContext({
        tool: 'edit',
        params: { command: 'rm -rf /' },
      }),
    );
    expect(result.action).toBe('allow');
  });

  it('checks all shell tool names', async () => {
    const hook = createShellRestrictionHook(['danger']);

    for (const tool of ['bash', 'shell', 'exec', 'terminal', 'command']) {
      const result = await hook(
        makeContext({
          tool,
          params: { command: 'danger zone' },
        }),
      );
      expect(result.action).toBe('block');
    }
  });

  it('allows when no command in params', async () => {
    const hook = createShellRestrictionHook(['rm -rf']);

    const result = await hook(
      makeContext({
        tool: 'bash',
        params: {},
      }),
    );
    expect(result.action).toBe('allow');
  });

  it('supports cmd param key', async () => {
    const hook = createShellRestrictionHook(['rm -rf']);

    const result = await hook(
      makeContext({
        tool: 'bash',
        params: { cmd: 'rm -rf /' },
      }),
    );
    expect(result.action).toBe('block');
  });
});

// ── RateLimit Hook ──────────────────────────────────────────────

describe('createRateLimitHook', () => {
  it('allows calls within rate limit', async () => {
    const hook = createRateLimitHook(5);

    for (let i = 0; i < 5; i++) {
      const result = await hook(makeContext());
      expect(result.action).toBe('allow');
    }
  });

  it('blocks calls exceeding rate limit', async () => {
    const hook = createRateLimitHook(3);

    for (let i = 0; i < 3; i++) {
      await hook(makeContext());
    }

    const result = await hook(makeContext());
    expect(result.action).toBe('block');
    expect(result.reason).toContain('RateLimit');
    expect(result.reason).toContain('3 calls/minute');
  });

  it('tracks agents independently', async () => {
    const hook = createRateLimitHook(2);

    await hook(makeContext({ agentId: 'agent-a' }));
    await hook(makeContext({ agentId: 'agent-a' }));

    const resultA = await hook(makeContext({ agentId: 'agent-a' }));
    expect(resultA.action).toBe('block');

    const resultB = await hook(makeContext({ agentId: 'agent-b' }));
    expect(resultB.action).toBe('allow');
  });
});

// ── buildHookPipeline ───────────────────────────────────────────

describe('buildHookPipeline', () => {
  it('builds pipeline with file guard', async () => {
    const pipeline = buildHookPipeline({
      allowedWritePaths: ['src/**'],
    });

    const allowed = await pipeline.execute(
      makeContext({
        tool: 'edit',
        params: { path: 'src/index.ts' },
      }),
    );
    expect(allowed.allowed).toBe(true);

    const blocked = await pipeline.execute(
      makeContext({
        tool: 'edit',
        params: { path: '/etc/passwd' },
      }),
    );
    expect(blocked.allowed).toBe(false);
  });

  it('builds pipeline with shell restriction', async () => {
    const pipeline = buildHookPipeline({
      blockedCommands: ['rm -rf'],
    });

    const blocked = await pipeline.execute(
      makeContext({
        tool: 'bash',
        params: { command: 'rm -rf /' },
      }),
    );
    expect(blocked.allowed).toBe(false);
  });

  it('builds pipeline with rate limit from maxAskUser', async () => {
    const pipeline = buildHookPipeline({
      maxAskUser: 1,
    });

    for (let i = 0; i < 10; i++) {
      const result = await pipeline.execute(makeContext());
      expect(result.allowed).toBe(true);
    }

    const blocked = await pipeline.execute(makeContext());
    expect(blocked.allowed).toBe(false);
  });

  it('builds empty pipeline with no config', async () => {
    const pipeline = buildHookPipeline({});

    const result = await pipeline.execute(
      makeContext({
        tool: 'edit',
        params: { path: '/anywhere' },
      }),
    );
    expect(result.allowed).toBe(true);
  });

  it('combines multiple hooks', async () => {
    const pipeline = buildHookPipeline({
      allowedWritePaths: ['src/**'],
      blockedCommands: ['rm -rf'],
    });

    const fileBlocked = await pipeline.execute(
      makeContext({
        tool: 'edit',
        params: { path: '/etc/passwd' },
      }),
    );
    expect(fileBlocked.allowed).toBe(false);

    const shellBlocked = await pipeline.execute(
      makeContext({
        tool: 'bash',
        params: { command: 'rm -rf /' },
      }),
    );
    expect(shellBlocked.allowed).toBe(false);

    const safe = await pipeline.execute(
      makeContext({
        tool: 'bash',
        params: { command: 'echo hello' },
      }),
    );
    expect(safe.allowed).toBe(true);
  });
});
