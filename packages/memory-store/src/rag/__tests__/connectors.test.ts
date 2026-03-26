/**
 * Unit tests for RAG ingestion connectors.
 *
 * Tests each connector (commit, PR, doc, task) with various inputs,
 * including edge cases: empty data, large diffs, non-English content.
 */

import { describe, expect, it } from 'vitest';

import {
  type CommitData,
  type DocData,
  ingestCommit,
  ingestDoc,
  ingestPullRequest,
  ingestTask,
  type PullRequestData,
  splitDiffByFile,
  type TaskData,
} from '../connectors.js';

// ── splitDiffByFile ────────────────────────────────────────────────

describe('splitDiffByFile', () => {
  it('splits a multi-file diff', () => {
    const diff = [
      'diff --git a/src/main.ts b/src/main.ts',
      'index abc..def 100644',
      '--- a/src/main.ts',
      '+++ b/src/main.ts',
      '@@ -1,3 +1,4 @@',
      '+import { init } from "./init";',
      ' const app = create();',
      'diff --git a/src/utils.ts b/src/utils.ts',
      'index 123..456 100644',
      '--- a/src/utils.ts',
      '+++ b/src/utils.ts',
      '@@ -10,2 +10,3 @@',
      '+export function helper() {}',
    ].join('\n');

    const files = splitDiffByFile(diff);
    expect(files.size).toBe(2);
    expect(files.has('src/main.ts')).toBe(true);
    expect(files.has('src/utils.ts')).toBe(true);
  });

  it('returns empty map for empty diff', () => {
    expect(splitDiffByFile('')).toEqual(new Map());
  });

  it('handles single-file diff', () => {
    const diff = [
      'diff --git a/readme.md b/readme.md',
      '--- a/readme.md',
      '+++ b/readme.md',
      '@@ -1 +1,2 @@',
      '+# New heading',
    ].join('\n');

    const files = splitDiffByFile(diff);
    expect(files.size).toBe(1);
    expect(files.has('readme.md')).toBe(true);
  });
});

// ── ingestCommit ───────────────────────────────────────────────────

describe('ingestCommit', () => {
  const baseCommit: CommitData = {
    sha: 'abc1234567890def1234567890abcdef12345678',
    message: 'feat: add authentication module',
    author: 'dev@example.com',
    date: '2025-01-15T10:00:00Z',
    diff: [
      'diff --git a/src/auth.ts b/src/auth.ts',
      '--- /dev/null',
      '+++ b/src/auth.ts',
      '@@ -0,0 +1,5 @@',
      '+export function authenticate() {',
      '+  return true;',
      '+}',
    ].join('\n'),
    files: ['src/auth.ts'],
  };

  it('produces summary chunk with commit message', () => {
    const inputs = ingestCommit(baseCommit);
    expect(inputs.length).toBeGreaterThanOrEqual(1);

    const summary = inputs[0]!;
    expect(summary.content).toContain('abc12345');
    expect(summary.content).toContain('add authentication module');
    expect(summary.content).toContain('dev@example.com');
    expect(summary.content).toContain('src/auth.ts');
    expect(summary.metadata.sourceType).toBe('commit');
    expect(summary.metadata.author).toBe('dev@example.com');
  });

  it('produces per-file diff chunks', () => {
    const inputs = ingestCommit(baseCommit);
    const diffChunks = inputs.filter((i) => i.metadata.filePath !== null);
    expect(diffChunks.length).toBe(1);
    expect(diffChunks[0]!.metadata.filePath).toBe('src/auth.ts');
    expect(diffChunks[0]!.content).toContain('authenticate');
  });

  it('returns empty for empty commit (no message, no diff)', () => {
    const empty: CommitData = {
      sha: 'empty123',
      message: '',
      author: 'dev@example.com',
      date: '2025-01-15T10:00:00Z',
      diff: '',
      files: [],
    };
    expect(ingestCommit(empty)).toEqual([]);
  });

  it('handles commit with message but no diff', () => {
    const noDiff: CommitData = {
      ...baseCommit,
      diff: '',
      files: [],
    };
    const inputs = ingestCommit(noDiff);
    expect(inputs.length).toBe(1); // Summary only
  });

  it('handles multi-file diffs', () => {
    const multiFile: CommitData = {
      ...baseCommit,
      diff: [
        'diff --git a/file1.ts b/file1.ts',
        '--- a/file1.ts',
        '+++ b/file1.ts',
        '+line 1',
        'diff --git a/file2.ts b/file2.ts',
        '--- a/file2.ts',
        '+++ b/file2.ts',
        '+line 2',
        'diff --git a/file3.ts b/file3.ts',
        '--- a/file3.ts',
        '+++ b/file3.ts',
        '+line 3',
      ].join('\n'),
      files: ['file1.ts', 'file2.ts', 'file3.ts'],
    };
    const inputs = ingestCommit(multiFile);
    // 1 summary + 3 file diffs
    expect(inputs.length).toBe(4);
  });

  it('handles non-English commit messages', () => {
    const nonEnglish: CommitData = {
      ...baseCommit,
      message: '機能追加：認証モジュール (日本語テスト)',
    };
    const inputs = ingestCommit(nonEnglish);
    expect(inputs[0]!.content).toContain('認証モジュール');
  });

  it('handles large diffs', () => {
    const largeDiff = [
      'diff --git a/big.ts b/big.ts',
      '--- a/big.ts',
      '+++ b/big.ts',
      ...Array.from({ length: 5000 }, (_, i) => `+line ${i}: ${'x'.repeat(100)}`),
    ].join('\n');

    const large: CommitData = {
      ...baseCommit,
      diff: largeDiff,
      files: ['big.ts'],
    };
    const inputs = ingestCommit(large);
    expect(inputs.length).toBeGreaterThanOrEqual(2);
    const bigDiffChunk = inputs.find((i) => i.metadata.filePath === 'big.ts');
    expect(bigDiffChunk).toBeDefined();
    expect(bigDiffChunk!.content.length).toBeGreaterThan(1000);
  });
});

// ── ingestPullRequest ──────────────────────────────────────────────

describe('ingestPullRequest', () => {
  const basePR: PullRequestData = {
    number: 42,
    title: 'Add user authentication',
    body: 'Implements JWT-based authentication with refresh tokens.',
    author: 'alice',
    state: 'merged',
    createdAt: '2025-01-10T08:00:00Z',
    updatedAt: '2025-01-12T16:00:00Z',
    diff: [
      'diff --git a/src/auth.ts b/src/auth.ts',
      '+++ b/src/auth.ts',
      '+export const auth = {};',
    ].join('\n'),
    comments: [
      { author: 'bob', body: 'LGTM! Good test coverage.', createdAt: '2025-01-11T10:00:00Z' },
      {
        author: 'carol',
        body: 'Consider adding rate limiting.',
        createdAt: '2025-01-11T14:00:00Z',
      },
    ],
    labels: ['feature', 'security'],
    files: ['src/auth.ts'],
  };

  it('produces PR summary chunk', () => {
    const inputs = ingestPullRequest(basePR);
    const summary = inputs[0]!;
    expect(summary.content).toContain('PR #42');
    expect(summary.content).toContain('Add user authentication');
    expect(summary.content).toContain('JWT-based');
    expect(summary.content).toContain('alice');
    expect(summary.content).toContain('merged');
    expect(summary.metadata.sourceType).toBe('pull_request');
    expect(summary.metadata.status).toBe('merged');
  });

  it('produces review comments chunk', () => {
    const inputs = ingestPullRequest(basePR);
    const commentChunk = inputs.find((i) => i.sourceId.includes('comments'));
    expect(commentChunk).toBeDefined();
    expect(commentChunk!.content).toContain('bob');
    expect(commentChunk!.content).toContain('LGTM');
    expect(commentChunk!.content).toContain('rate limiting');
  });

  it('produces diff chunks', () => {
    const inputs = ingestPullRequest(basePR);
    const diffChunks = inputs.filter((i) => i.sourceId.includes('diff:'));
    expect(diffChunks.length).toBeGreaterThanOrEqual(1);
  });

  it('includes labels in tags', () => {
    const inputs = ingestPullRequest(basePR);
    expect(inputs[0]!.metadata.tags).toContain('feature');
    expect(inputs[0]!.metadata.tags).toContain('security');
  });

  it('handles PR with no body', () => {
    const noBody: PullRequestData = { ...basePR, body: '' };
    const inputs = ingestPullRequest(noBody);
    expect(inputs[0]!.content).toContain('(no description)');
  });

  it('handles PR with no comments', () => {
    const noComments: PullRequestData = { ...basePR, comments: [] };
    const inputs = ingestPullRequest(noComments);
    const commentChunk = inputs.find((i) => i.sourceId.includes('comments'));
    expect(commentChunk).toBeUndefined();
  });

  it('handles PR with no diff', () => {
    const noDiff: PullRequestData = { ...basePR, diff: '', files: [] };
    const inputs = ingestPullRequest(noDiff);
    const diffChunks = inputs.filter((i) => i.sourceId.includes('diff:'));
    expect(diffChunks).toHaveLength(0);
  });

  it('handles open vs closed vs merged states', () => {
    for (const state of ['open', 'closed', 'merged'] as const) {
      const pr: PullRequestData = { ...basePR, state };
      const inputs = ingestPullRequest(pr);
      expect(inputs[0]!.metadata.status).toBe(state);
      expect(inputs[0]!.content).toContain(state);
    }
  });
});

// ── ingestDoc ──────────────────────────────────────────────────────

describe('ingestDoc', () => {
  const baseDoc: DocData = {
    path: 'docs/architecture.md',
    title: 'Architecture Overview',
    content:
      '# Architecture\n\nThis document describes the system architecture.\n\n## Components\n\nThe system has three main components.',
    author: 'tech-lead',
    updatedAt: '2025-01-20T12:00:00Z',
  };

  it('produces a chunk input from doc content', () => {
    const inputs = ingestDoc(baseDoc);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.content).toContain('Architecture');
    expect(inputs[0]!.content).toContain('three main components');
    expect(inputs[0]!.metadata.sourceType).toBe('doc');
    expect(inputs[0]!.metadata.squadPath).toBe('docs/architecture.md');
    expect(inputs[0]!.metadata.author).toBe('tech-lead');
  });

  it('returns empty for empty doc content', () => {
    const empty: DocData = { ...baseDoc, content: '' };
    expect(ingestDoc(empty)).toEqual([]);
  });

  it('returns empty for whitespace-only content', () => {
    const ws: DocData = { ...baseDoc, content: '   \n\n\t  ' };
    expect(ingestDoc(ws)).toEqual([]);
  });

  it('handles non-English documentation', () => {
    const chinese: DocData = {
      ...baseDoc,
      content: '# 架构概述\n\n本文档描述了系统架构。\n\n## 组件\n\n系统有三个主要组件。',
    };
    const inputs = ingestDoc(chinese);
    expect(inputs).toHaveLength(1);
    expect(inputs[0]!.content).toContain('架构概述');
  });

  it('handles doc with null author', () => {
    const noAuthor: DocData = { ...baseDoc, author: null };
    const inputs = ingestDoc(noAuthor);
    expect(inputs[0]!.metadata.author).toBeNull();
  });

  it('sets documentation tag', () => {
    const inputs = ingestDoc(baseDoc);
    expect(inputs[0]!.metadata.tags).toContain('documentation');
  });
});

// ── ingestTask ─────────────────────────────────────────────────────

describe('ingestTask', () => {
  const baseTask: TaskData = {
    id: 'task-auth-001',
    title: 'Implement JWT authentication',
    description: 'Build JWT auth with access and refresh tokens, including middleware.',
    assignee: 'dev-agent',
    status: 'in_progress',
    priority: 'P1',
    agentIds: ['agent-backend', 'agent-security'],
    createdAt: '2025-01-15T09:00:00Z',
    updatedAt: '2025-01-16T11:00:00Z',
    tags: ['auth', 'security'],
    progressLog: [
      'Created JWT utility module',
      'Added refresh token rotation',
      'Implemented auth middleware',
    ],
  };

  it('produces task summary chunk', () => {
    const inputs = ingestTask(baseTask);
    expect(inputs.length).toBeGreaterThanOrEqual(1);

    const summary = inputs[0]!;
    expect(summary.content).toContain('Implement JWT authentication');
    expect(summary.content).toContain('in_progress');
    expect(summary.content).toContain('P1');
    expect(summary.content).toContain('dev-agent');
    expect(summary.metadata.sourceType).toBe('task');
    expect(summary.metadata.agentIds).toContain('agent-backend');
    expect(summary.metadata.agentIds).toContain('agent-security');
    expect(summary.metadata.priority).toBe('P1');
    expect(summary.metadata.status).toBe('in_progress');
  });

  it('produces progress log chunk', () => {
    const inputs = ingestTask(baseTask);
    const logChunk = inputs.find((i) => i.sourceId.includes('progress'));
    expect(logChunk).toBeDefined();
    expect(logChunk!.content).toContain('JWT utility module');
    expect(logChunk!.content).toContain('refresh token rotation');
    expect(logChunk!.content).toContain('auth middleware');
  });

  it('skips progress log when empty', () => {
    const noLog: TaskData = { ...baseTask, progressLog: [] };
    const inputs = ingestTask(noLog);
    const logChunk = inputs.find((i) => i.sourceId.includes('progress'));
    expect(logChunk).toBeUndefined();
  });

  it('handles task with no description', () => {
    const noDesc: TaskData = { ...baseTask, description: '' };
    const inputs = ingestTask(noDesc);
    expect(inputs[0]!.content).toContain('(no description)');
  });

  it('handles task with no assignee or priority', () => {
    const minimal: TaskData = {
      ...baseTask,
      assignee: null,
      priority: null,
    };
    const inputs = ingestTask(minimal);
    expect(inputs[0]!.content).not.toContain('Assignee');
    // Priority line should be absent
    expect(inputs[0]!.content).not.toContain('Priority');
  });

  it('includes task tags in metadata', () => {
    const inputs = ingestTask(baseTask);
    expect(inputs[0]!.metadata.tags).toContain('task');
    expect(inputs[0]!.metadata.tags).toContain('auth');
    expect(inputs[0]!.metadata.tags).toContain('security');
  });

  it('handles task with empty agentIds', () => {
    const noAgents: TaskData = { ...baseTask, agentIds: [] };
    const inputs = ingestTask(noAgents);
    expect(inputs[0]!.metadata.agentIds).toEqual([]);
  });
});
