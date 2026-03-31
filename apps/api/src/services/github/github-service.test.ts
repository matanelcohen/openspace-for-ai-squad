/**
 * Unit tests for GitHubService — focuses on the new getPRChecks(), getPR(),
 * and mergePR() methods. Mocks execSync to verify correct `gh` CLI commands.
 */

import { execSync } from 'node:child_process';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { GitHubService } from './index.js';

// ---------------------------------------------------------------------------
// Mock child_process
// ---------------------------------------------------------------------------

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createService(): GitHubService {
  return new GitHubService('/fake/project');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GitHubService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getPR ─────────────────────────────────────────────────────

  describe('getPR', () => {
    it('constructs the correct gh pr view command', async () => {
      mockExecSync.mockReturnValue(
        JSON.stringify({
          number: 42,
          title: 'Add feature X',
          body: 'Description here',
          state: 'OPEN',
          headRefName: 'task/my-task',
          baseRefName: 'main',
          url: 'https://github.com/owner/repo/pull/42',
        }),
      );

      const svc = createService();
      const pr = await svc.getPR(42);

      expect(mockExecSync).toHaveBeenCalledWith(
        'gh pr view 42 --json number,title,body,state,headRefName,baseRefName,url',
        expect.objectContaining({ cwd: '/fake/project', encoding: 'utf-8' }),
      );
      expect(pr.number).toBe(42);
      expect(pr.title).toBe('Add feature X');
      expect(pr.state).toBe('OPEN');
      expect(pr.head.ref).toBe('task/my-task');
      expect(pr.base.ref).toBe('main');
    });

    it('maps headRefName/baseRefName to head.ref/base.ref correctly', async () => {
      mockExecSync.mockReturnValue(
        JSON.stringify({
          number: 7,
          title: 'Fix bug',
          body: '',
          state: 'MERGED',
          headRefName: 'fix/bug-7',
          baseRefName: 'develop',
          url: 'https://github.com/o/r/pull/7',
        }),
      );

      const pr = await createService().getPR(7);
      expect(pr.head.ref).toBe('fix/bug-7');
      expect(pr.base.ref).toBe('develop');
      expect(pr.state).toBe('MERGED');
    });

    it('defaults body to empty string when null', async () => {
      mockExecSync.mockReturnValue(
        JSON.stringify({
          number: 1,
          title: 'No body',
          body: null,
          state: 'OPEN',
          headRefName: 'branch',
          baseRefName: 'main',
          url: 'https://github.com/o/r/pull/1',
        }),
      );

      const pr = await createService().getPR(1);
      expect(pr.body).toBe('');
    });
  });

  // ── getPRChecks ───────────────────────────────────────────────

  describe('getPRChecks', () => {
    it('constructs the correct gh pr checks command', async () => {
      mockExecSync.mockReturnValue(
        JSON.stringify([
          { name: 'CI / build', state: 'SUCCESS', conclusion: 'SUCCESS' },
          { name: 'CI / lint', state: 'SUCCESS', conclusion: 'SUCCESS' },
        ]),
      );

      const svc = createService();
      const checks = await svc.getPRChecks(99);

      expect(mockExecSync).toHaveBeenCalledWith(
        'gh pr checks 99 --json name,state,conclusion',
        expect.objectContaining({ cwd: '/fake/project' }),
      );
      expect(checks).toHaveLength(2);
      expect(checks[0]!.name).toBe('CI / build');
      expect(checks[0]!.conclusion).toBe('SUCCESS');
    });

    it('returns empty array when no checks are configured', async () => {
      mockExecSync.mockReturnValue(JSON.stringify([]));

      const checks = await createService().getPRChecks(5);
      expect(checks).toEqual([]);
    });

    it('returns empty array when gh command fails (no checks configured)', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('no checks');
      });

      const checks = await createService().getPRChecks(5);
      expect(checks).toEqual([]);
    });

    it('parses pending checks correctly', async () => {
      mockExecSync.mockReturnValue(
        JSON.stringify([
          { name: 'CI / build', state: 'PENDING', conclusion: '' },
          { name: 'CI / lint', state: 'SUCCESS', conclusion: 'SUCCESS' },
        ]),
      );

      const checks = await createService().getPRChecks(10);
      expect(checks).toHaveLength(2);
      expect(checks[0]!.state).toBe('PENDING');
      expect(checks[0]!.conclusion).toBe('');
      expect(checks[1]!.state).toBe('SUCCESS');
    });

    it('parses failed checks correctly', async () => {
      mockExecSync.mockReturnValue(
        JSON.stringify([
          { name: 'CI / build', state: 'COMPLETED', conclusion: 'FAILURE' },
        ]),
      );

      const checks = await createService().getPRChecks(10);
      expect(checks[0]!.conclusion).toBe('FAILURE');
    });
  });

  // ── mergePR ───────────────────────────────────────────────────

  describe('mergePR', () => {
    it('constructs a squash merge command by default', async () => {
      mockExecSync.mockReturnValue('');

      await createService().mergePR(42);

      expect(mockExecSync).toHaveBeenCalledWith(
        'gh pr merge 42 --squash --delete-branch',
        expect.objectContaining({
          cwd: '/fake/project',
          timeout: 120_000,
        }),
      );
    });

    it('supports merge method', async () => {
      mockExecSync.mockReturnValue('');

      await createService().mergePR(42, 'merge');

      expect(mockExecSync).toHaveBeenCalledWith(
        'gh pr merge 42 --merge --delete-branch',
        expect.objectContaining({ cwd: '/fake/project' }),
      );
    });

    it('supports rebase method', async () => {
      mockExecSync.mockReturnValue('');

      await createService().mergePR(42, 'rebase');

      expect(mockExecSync).toHaveBeenCalledWith(
        'gh pr merge 42 --rebase --delete-branch',
        expect.objectContaining({ cwd: '/fake/project' }),
      );
    });

    it('throws when merge fails', async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error('merge conflict');
      });

      await expect(createService().mergePR(42)).rejects.toThrow('merge conflict');
    });

    it('uses 120s timeout for merge operations', async () => {
      mockExecSync.mockReturnValue('');

      await createService().mergePR(1);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ timeout: 120_000 }),
      );
    });
  });

  // ── Existing methods (smoke tests) ────────────────────────────

  describe('listPRs', () => {
    it('parses PR list output correctly', async () => {
      mockExecSync.mockReturnValue(
        JSON.stringify([
          {
            number: 1,
            title: 'PR one',
            body: 'body',
            state: 'OPEN',
            headRefName: 'feature/a',
            baseRefName: 'main',
            url: 'https://github.com/o/r/pull/1',
          },
        ]),
      );

      const prs = await createService().listPRs();
      expect(prs).toHaveLength(1);
      expect(prs[0]!.head.ref).toBe('feature/a');
    });
  });
});
