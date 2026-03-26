import { describe, expect, it } from 'vitest';

import { resolveToolParams, resolvePath } from '../workflow/parameter-resolver.js';
import type { ExecutionContext, ParameterMapping } from '../types/dag-workflow.js';

// ── Test Helpers ────────────────────────────────────────────────

function makeCtx(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    workflowVersion: '1.0.0',
    vars: { repoUrl: 'https://github.com/test/repo', branch: 'main' },
    nodeOutputs: {
      'fetch-repo': {
        data: { sha: 'abc123', files: ['a.ts', 'b.ts'] },
        completedAt: '2026-01-01T00:00:01Z',
        durationMs: 500,
      },
    },
    secrets: { GITHUB_TOKEN: 'ghp_secret123' },
    toolRegistry: { invoke: async () => ({ success: true, durationMs: 0 }), discover: () => [] },
    startedAt: '2026-01-01T00:00:00Z',
    traceId: 'trace-1',
    ...overrides,
  };
}

// ── resolvePath Tests ───────────────────────────────────────────

describe('resolvePath', () => {
  it('resolves simple ctx.vars path', () => {
    expect(resolvePath('ctx.vars.repoUrl', makeCtx())).toBe('https://github.com/test/repo');
  });

  it('resolves ctx.secrets path', () => {
    expect(resolvePath('ctx.secrets.GITHUB_TOKEN', makeCtx())).toBe('ghp_secret123');
  });

  it('resolves bracket notation for node outputs', () => {
    expect(resolvePath("ctx.nodeOutputs['fetch-repo'].data.sha", makeCtx())).toBe('abc123');
  });

  it('resolves nested array in node outputs', () => {
    const files = resolvePath("ctx.nodeOutputs['fetch-repo'].data.files", makeCtx());
    expect(files).toEqual(['a.ts', 'b.ts']);
  });

  it('returns undefined for missing paths', () => {
    expect(resolvePath('ctx.vars.nonexistent', makeCtx())).toBeUndefined();
  });

  it('returns undefined for deeply missing paths', () => {
    expect(resolvePath('ctx.nonexistent.deep.path', makeCtx())).toBeUndefined();
  });

  it('resolves ctx.executionId', () => {
    expect(resolvePath('ctx.executionId', makeCtx())).toBe('exec-1');
  });

  it('throws on unclosed bracket', () => {
    expect(() => resolvePath("ctx.nodeOutputs['bad", makeCtx())).toThrow('Unclosed bracket');
  });
});

// ── resolveToolParams Tests ─────────────────────────────────────

describe('resolveToolParams', () => {
  it('returns empty object for undefined params', () => {
    expect(resolveToolParams(undefined, makeCtx())).toEqual({});
  });

  it('returns static params as-is when params is a plain object', () => {
    const params = { url: 'https://example.com', count: 10 };
    expect(resolveToolParams(params, makeCtx())).toEqual(params);
  });

  it('resolves ParameterMapping array against context', () => {
    const mappings: ParameterMapping[] = [
      { param: 'repo', from: 'ctx.vars.repoUrl' },
      { param: 'branch', from: 'ctx.vars.branch' },
      { param: 'token', from: 'ctx.secrets.GITHUB_TOKEN' },
      { param: 'sha', from: "ctx.nodeOutputs['fetch-repo'].data.sha" },
    ];

    const resolved = resolveToolParams(mappings, makeCtx());
    expect(resolved).toEqual({
      repo: 'https://github.com/test/repo',
      branch: 'main',
      token: 'ghp_secret123',
      sha: 'abc123',
    });
  });

  it('resolves missing mappings to undefined', () => {
    const mappings: ParameterMapping[] = [
      { param: 'missing', from: 'ctx.vars.nonexistent' },
    ];
    const resolved = resolveToolParams(mappings, makeCtx());
    expect(resolved).toEqual({ missing: undefined });
  });
});
