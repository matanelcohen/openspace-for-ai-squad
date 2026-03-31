/**
 * Unit tests for PRAutoMergeService — verifies auto-merge logic:
 *   - Identifies tasks with `merge:auto` label
 *   - Merges PRs when all checks pass
 *   - Skips when checks are pending or failing
 *   - Handles PR already merged externally
 *   - Handles PR closed without merge
 *   - Cleans up worktree + branch after merge
 *   - Updates task status and labels
 *   - Edge cases: no checks configured, no PR label, merge failures
 */

import type { Task } from '@matanelcohen/openspace-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GitHubService, PRCheckRun } from './index.js';
import { PRAutoMergeService, type PRAutoMergeConfig } from './auto-merge.js';
import type { WorktreeService } from '../worktree/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-abc123',
    title: 'Test task',
    description: 'A test task',
    status: 'in-progress',
    priority: 'P1',
    assignee: 'bender',
    assigneeType: 'agent',
    labels: ['pr:42', 'merge:auto'],
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    sortIndex: 0,
    ...overrides,
  };
}

function makeMockGitHubService(): GitHubService {
  return {
    getPR: vi.fn(),
    getPRChecks: vi.fn(),
    mergePR: vi.fn(),
    listPRs: vi.fn(),
    listIssues: vi.fn(),
    getIssue: vi.fn(),
    createIssueFromTask: vi.fn(),
    createBranch: vi.fn(),
    getCurrentBranch: vi.fn(),
    getDiffStat: vi.fn(),
    createPR: vi.fn(),
  } as unknown as GitHubService;
}

function makeMockWorktreeService(): WorktreeService {
  return {
    destroy: vi.fn().mockResolvedValue(undefined),
    get: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    commit: vi.fn(),
    diff: vi.fn(),
    createPR: vi.fn(),
    createFeaturePR: vi.fn(),
    cleanupDelegation: vi.fn(),
    cleanupStale: vi.fn(),
    cleanupDoneTasks: vi.fn(),
    init: vi.fn(),
    ensureFeatureBranch: vi.fn(),
    autoCommit: true,
    autoPR: true,
  } as unknown as WorktreeService;
}

function createService(
  overrides: Partial<PRAutoMergeConfig> = {},
): {
  service: PRAutoMergeService;
  github: ReturnType<typeof makeMockGitHubService>;
  worktree: ReturnType<typeof makeMockWorktreeService>;
  updateTask: ReturnType<typeof vi.fn>;
} {
  const github = makeMockGitHubService();
  const worktree = makeMockWorktreeService();
  const updateTask = vi.fn().mockResolvedValue(undefined);

  const service = new PRAutoMergeService({
    githubService: github,
    worktreeService: worktree,
    tasksDir: '/fake/tasks',
    updateTask,
    mergeMethod: 'squash',
    ...overrides,
  });

  return { service, github, worktree, updateTask };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PRAutoMergeService', () => {
  // ── findAutoMergeTasks ────────────────────────────────────────

  describe('findAutoMergeTasks', () => {
    it('returns only tasks with merge:auto label', () => {
      const { service } = createService();
      const tasks: Task[] = [
        makeTask({ id: 't1', labels: ['merge:auto', 'pr:1'] }),
        makeTask({ id: 't2', labels: ['pr:2'] }),
        makeTask({ id: 't3', labels: ['merge:auto', 'pr:3'] }),
        makeTask({ id: 't4', labels: [] }),
      ];

      const result = service.findAutoMergeTasks(tasks);
      expect(result).toHaveLength(2);
      expect(result.map((t) => t.id)).toEqual(['t1', 't3']);
    });

    it('returns empty array when no tasks have merge:auto', () => {
      const { service } = createService();
      const tasks = [makeTask({ labels: ['pr:1'] })];
      expect(service.findAutoMergeTasks(tasks)).toEqual([]);
    });

    it('handles empty task list', () => {
      const { service } = createService();
      expect(service.findAutoMergeTasks([])).toEqual([]);
    });
  });

  // ── extractPRNumber ───────────────────────────────────────────

  describe('extractPRNumber', () => {
    it('extracts PR number from pr:N label', () => {
      const { service } = createService();
      expect(service.extractPRNumber(makeTask({ labels: ['pr:42'] }))).toBe(42);
    });

    it('returns null when no pr: label exists', () => {
      const { service } = createService();
      expect(service.extractPRNumber(makeTask({ labels: ['merge:auto'] }))).toBeNull();
    });

    it('returns null for invalid PR number', () => {
      const { service } = createService();
      expect(service.extractPRNumber(makeTask({ labels: ['pr:abc'] }))).toBeNull();
    });

    it('handles multiple pr: labels (takes first)', () => {
      const { service } = createService();
      expect(
        service.extractPRNumber(makeTask({ labels: ['pr:10', 'pr:20'] })),
      ).toBe(10);
    });

    it('handles empty labels', () => {
      const { service } = createService();
      expect(service.extractPRNumber(makeTask({ labels: [] }))).toBeNull();
    });
  });

  // ── allChecksPassed ───────────────────────────────────────────

  describe('allChecksPassed', () => {
    it('returns true when all checks have SUCCESS conclusion', () => {
      const { service } = createService();
      const checks: PRCheckRun[] = [
        { name: 'build', state: 'COMPLETED', conclusion: 'SUCCESS' },
        { name: 'lint', state: 'COMPLETED', conclusion: 'SUCCESS' },
      ];
      expect(service.allChecksPassed(checks)).toBe(true);
    });

    it('returns true when all checks have SUCCESS state', () => {
      const { service } = createService();
      const checks: PRCheckRun[] = [
        { name: 'build', state: 'SUCCESS', conclusion: '' },
      ];
      expect(service.allChecksPassed(checks)).toBe(true);
    });

    it('returns true when no checks exist (no checks configured)', () => {
      const { service } = createService();
      expect(service.allChecksPassed([])).toBe(true);
    });

    it('returns false when any check has FAILURE conclusion', () => {
      const { service } = createService();
      const checks: PRCheckRun[] = [
        { name: 'build', state: 'COMPLETED', conclusion: 'SUCCESS' },
        { name: 'lint', state: 'COMPLETED', conclusion: 'FAILURE' },
      ];
      expect(service.allChecksPassed(checks)).toBe(false);
    });

    it('returns false when check has ERROR conclusion', () => {
      const { service } = createService();
      const checks: PRCheckRun[] = [
        { name: 'build', state: 'COMPLETED', conclusion: 'ERROR' },
      ];
      expect(service.allChecksPassed(checks)).toBe(false);
    });
  });

  // ── hasChecksPending ──────────────────────────────────────────

  describe('hasChecksPending', () => {
    it('returns true when a check has PENDING state', () => {
      const { service } = createService();
      const checks: PRCheckRun[] = [
        { name: 'build', state: 'PENDING', conclusion: '' },
      ];
      expect(service.hasChecksPending(checks)).toBe(true);
    });

    it('returns true when a check has empty conclusion', () => {
      const { service } = createService();
      const checks: PRCheckRun[] = [
        { name: 'build', state: 'IN_PROGRESS', conclusion: '' },
      ];
      expect(service.hasChecksPending(checks)).toBe(true);
    });

    it('returns false when all checks are completed', () => {
      const { service } = createService();
      const checks: PRCheckRun[] = [
        { name: 'build', state: 'COMPLETED', conclusion: 'SUCCESS' },
        { name: 'lint', state: 'COMPLETED', conclusion: 'FAILURE' },
      ];
      expect(service.hasChecksPending(checks)).toBe(false);
    });

    it('returns false for empty checks array', () => {
      const { service } = createService();
      expect(service.hasChecksPending([])).toBe(false);
    });
  });

  // ── processTask — happy path ──────────────────────────────────

  describe('processTask — merge when checks pass', () => {
    it('merges PR when all checks pass', async () => {
      const { service, github, updateTask } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42,
        title: 'Fix',
        body: '',
        state: 'OPEN',
        head: { ref: 'task/abc' },
        base: { ref: 'main' },
        url: 'https://github.com/o/r/pull/42',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([
        { name: 'build', state: 'COMPLETED', conclusion: 'SUCCESS' },
      ]);
      vi.mocked(github.mergePR).mockResolvedValue(undefined);

      const result = await service.processTask(task);

      expect(result.action).toBe('merged');
      expect(result.prNumber).toBe(42);
      expect(result.message).toBe('PR merged successfully');
      expect(github.mergePR).toHaveBeenCalledWith(42, 'squash');
    });

    it('updates task status to done and replaces merge:auto with merged', async () => {
      const { service, github, updateTask } = createService();
      const task = makeTask({ labels: ['pr:42', 'merge:auto', 'backend'] });

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([]);
      vi.mocked(github.mergePR).mockResolvedValue(undefined);

      await service.processTask(task);

      expect(updateTask).toHaveBeenCalledWith('/fake/tasks', task.id, {
        status: 'done',
        labels: ['pr:42', 'backend', 'merged'],
      });
    });

    it('cleans up worktree and branch after merge', async () => {
      const { service, github, worktree } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([]);
      vi.mocked(github.mergePR).mockResolvedValue(undefined);

      await service.processTask(task);

      expect(worktree.destroy).toHaveBeenCalledWith(task.id, {
        deleteBranch: true,
      });
    });

    it('uses configured merge method', async () => {
      const { service, github } = createService({ mergeMethod: 'rebase' });
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([]);
      vi.mocked(github.mergePR).mockResolvedValue(undefined);

      await service.processTask(task);
      expect(github.mergePR).toHaveBeenCalledWith(42, 'rebase');
    });
  });

  // ── processTask — pending checks ─────────────────────────────

  describe('processTask — pending checks', () => {
    it('returns pending when checks are still running', async () => {
      const { service, github } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([
        { name: 'build', state: 'PENDING', conclusion: '' },
        { name: 'lint', state: 'COMPLETED', conclusion: 'SUCCESS' },
      ]);

      const result = await service.processTask(task);

      expect(result.action).toBe('pending');
      expect(github.mergePR).not.toHaveBeenCalled();
    });

    it('does not update task status when pending', async () => {
      const { service, github, updateTask } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([
        { name: 'build', state: 'PENDING', conclusion: '' },
      ]);

      await service.processTask(task);
      expect(updateTask).not.toHaveBeenCalled();
    });
  });

  // ── processTask — failing checks ─────────────────────────────

  describe('processTask — failing checks', () => {
    it('returns failed when checks fail', async () => {
      const { service, github } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([
        { name: 'build', state: 'COMPLETED', conclusion: 'FAILURE' },
      ]);

      const result = await service.processTask(task);

      expect(result.action).toBe('failed');
      expect(result.message).toBe('One or more checks failed');
      expect(github.mergePR).not.toHaveBeenCalled();
    });

    it('does not update task or clean up worktree when checks fail', async () => {
      const { service, github, updateTask, worktree } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([
        { name: 'build', state: 'COMPLETED', conclusion: 'FAILURE' },
      ]);

      await service.processTask(task);
      expect(updateTask).not.toHaveBeenCalled();
      expect(worktree.destroy).not.toHaveBeenCalled();
    });
  });

  // ── processTask — edge cases ──────────────────────────────────

  describe('processTask — edge cases', () => {
    it('handles PR already merged externally', async () => {
      const { service, github, updateTask } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'MERGED',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });

      const result = await service.processTask(task);

      expect(result.action).toBe('already-merged');
      expect(result.message).toBe('PR was merged externally');
      expect(github.mergePR).not.toHaveBeenCalled();
      // Should still update task to done + merged
      expect(updateTask).toHaveBeenCalledWith('/fake/tasks', task.id, {
        status: 'done',
        labels: expect.arrayContaining(['merged']),
      });
    });

    it('handles PR closed without merge', async () => {
      const { service, github, updateTask } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'CLOSED',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });

      const result = await service.processTask(task);

      expect(result.action).toBe('closed');
      expect(result.message).toBe('PR was closed without merge');
      expect(github.mergePR).not.toHaveBeenCalled();
      expect(updateTask).toHaveBeenCalledWith('/fake/tasks', task.id, {
        status: 'blocked',
        labels: expect.arrayContaining(['pr-closed']),
      });
    });

    it('PR closed removes merge:auto and adds pr-closed label', async () => {
      const { service, github, updateTask } = createService();
      const task = makeTask({ labels: ['pr:42', 'merge:auto', 'backend'] });

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'CLOSED',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });

      await service.processTask(task);

      expect(updateTask).toHaveBeenCalledWith('/fake/tasks', task.id, {
        status: 'blocked',
        labels: ['pr:42', 'backend', 'pr-closed'],
      });
    });

    it('no checks configured on repo — auto-merges', async () => {
      const { service, github } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([]);
      vi.mocked(github.mergePR).mockResolvedValue(undefined);

      const result = await service.processTask(task);

      expect(result.action).toBe('merged');
      expect(github.mergePR).toHaveBeenCalledWith(42, 'squash');
    });

    it('skips task with no PR label', async () => {
      const { service } = createService();
      const task = makeTask({ labels: ['merge:auto'] });

      const result = await service.processTask(task);

      expect(result.action).toBe('skipped');
      expect(result.prNumber).toBe(0);
      expect(result.message).toBe('No PR number found in labels');
    });

    it('handles PR fetch failure', async () => {
      const { service, github } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockRejectedValue(new Error('network error'));

      const result = await service.processTask(task);

      expect(result.action).toBe('failed');
      expect(result.message).toBe('Could not fetch PR status');
    });

    it('handles merge failure', async () => {
      const { service, github, updateTask } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([
        { name: 'build', state: 'COMPLETED', conclusion: 'SUCCESS' },
      ]);
      vi.mocked(github.mergePR).mockRejectedValue(
        new Error('merge conflict'),
      );

      const result = await service.processTask(task);

      expect(result.action).toBe('failed');
      expect(result.message).toContain('Merge failed');
      expect(result.message).toContain('merge conflict');
      expect(updateTask).not.toHaveBeenCalled();
    });

    it('handles worktree cleanup failure gracefully', async () => {
      const { service, github, worktree, updateTask } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([]);
      vi.mocked(github.mergePR).mockResolvedValue(undefined);
      vi.mocked(worktree.destroy).mockRejectedValue(
        new Error('worktree already removed'),
      );

      // Should not throw — worktree cleanup errors are swallowed
      const result = await service.processTask(task);
      expect(result.action).toBe('merged');
      expect(updateTask).toHaveBeenCalled();
    });

    it('works without worktree service', async () => {
      const { service, github, updateTask } = createService({
        worktreeService: undefined,
      });
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([]);
      vi.mocked(github.mergePR).mockResolvedValue(undefined);

      const result = await service.processTask(task);
      expect(result.action).toBe('merged');
      expect(updateTask).toHaveBeenCalled();
    });
  });

  // ── processAutoMergeTasks ─────────────────────────────────────

  describe('processAutoMergeTasks', () => {
    it('processes only tasks with merge:auto label', async () => {
      const { service, github } = createService();
      const tasks = [
        makeTask({ id: 't1', labels: ['pr:1', 'merge:auto'] }),
        makeTask({ id: 't2', labels: ['pr:2'] }), // no merge:auto
        makeTask({ id: 't3', labels: ['pr:3', 'merge:auto'] }),
      ];

      vi.mocked(github.getPR).mockResolvedValue({
        number: 1, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([]);
      vi.mocked(github.mergePR).mockResolvedValue(undefined);

      const results = await service.processAutoMergeTasks(tasks);

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.taskId)).toEqual(['t1', 't3']);
    });

    it('returns individual results for each task', async () => {
      const { service, github } = createService();
      const tasks = [
        makeTask({ id: 't1', labels: ['pr:1', 'merge:auto'] }),
        makeTask({ id: 't2', labels: ['merge:auto'] }), // no pr: label
      ];

      vi.mocked(github.getPR).mockResolvedValue({
        number: 1, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([]);
      vi.mocked(github.mergePR).mockResolvedValue(undefined);

      const results = await service.processAutoMergeTasks(tasks);

      expect(results[0]!.action).toBe('merged');
      expect(results[1]!.action).toBe('skipped');
    });

    it('returns empty array for no auto-merge tasks', async () => {
      const { service } = createService();
      const results = await service.processAutoMergeTasks([
        makeTask({ labels: ['pr:1'] }),
      ]);
      expect(results).toEqual([]);
    });

    it('handles mix of outcomes', async () => {
      const { service, github } = createService();
      const tasks = [
        makeTask({ id: 't1', labels: ['pr:1', 'merge:auto'] }),
        makeTask({ id: 't2', labels: ['pr:2', 'merge:auto'] }),
        makeTask({ id: 't3', labels: ['pr:3', 'merge:auto'] }),
      ];

      vi.mocked(github.getPR)
        .mockResolvedValueOnce({
          number: 1, title: '', body: '', state: 'OPEN',
          head: { ref: '' }, base: { ref: '' }, url: '',
        })
        .mockResolvedValueOnce({
          number: 2, title: '', body: '', state: 'MERGED',
          head: { ref: '' }, base: { ref: '' }, url: '',
        })
        .mockResolvedValueOnce({
          number: 3, title: '', body: '', state: 'OPEN',
          head: { ref: '' }, base: { ref: '' }, url: '',
        });

      vi.mocked(github.getPRChecks)
        .mockResolvedValueOnce([
          { name: 'build', state: 'COMPLETED', conclusion: 'SUCCESS' },
        ])
        .mockResolvedValueOnce([
          { name: 'build', state: 'PENDING', conclusion: '' },
        ]);

      vi.mocked(github.mergePR).mockResolvedValue(undefined);

      const results = await service.processAutoMergeTasks(tasks);

      expect(results[0]!.action).toBe('merged');
      expect(results[1]!.action).toBe('already-merged');
      expect(results[2]!.action).toBe('pending');
    });
  });

  // ── CI-specific edge cases ────────────────────────────────────

  describe('CI edge cases', () => {
    it('CI fails permanently — task stays, no merge', async () => {
      const { service, github, updateTask } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([
        { name: 'build', state: 'COMPLETED', conclusion: 'FAILURE' },
        { name: 'test', state: 'COMPLETED', conclusion: 'FAILURE' },
      ]);

      const result = await service.processTask(task);

      expect(result.action).toBe('failed');
      expect(github.mergePR).not.toHaveBeenCalled();
      expect(updateTask).not.toHaveBeenCalled();
    });

    it('mixed check states — some pass, one fails', async () => {
      const { service, github } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([
        { name: 'build', state: 'COMPLETED', conclusion: 'SUCCESS' },
        { name: 'test', state: 'COMPLETED', conclusion: 'SUCCESS' },
        { name: 'deploy', state: 'COMPLETED', conclusion: 'FAILURE' },
      ]);

      const result = await service.processTask(task);
      expect(result.action).toBe('failed');
    });

    it('pending takes priority over failure (checks still running)', async () => {
      const { service, github } = createService();
      const task = makeTask();

      vi.mocked(github.getPR).mockResolvedValue({
        number: 42, title: '', body: '', state: 'OPEN',
        head: { ref: '' }, base: { ref: '' }, url: '',
      });
      vi.mocked(github.getPRChecks).mockResolvedValue([
        { name: 'build', state: 'PENDING', conclusion: '' },
        { name: 'lint', state: 'COMPLETED', conclusion: 'FAILURE' },
      ]);

      const result = await service.processTask(task);
      // Pending check should be reported first
      expect(result.action).toBe('pending');
    });
  });
});
