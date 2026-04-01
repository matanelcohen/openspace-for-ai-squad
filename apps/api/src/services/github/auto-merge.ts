/**
 * PRAutoMergeService — monitors tasks with `merge:auto` label and
 * auto-merges their PRs once CI checks pass.
 *
 * Flow:
 *   1. Agent completes task → PR created → task gets `merge:auto` + `pr:N` labels
 *   2. This service polls tasks, finds ones with `merge:auto`
 *   3. Checks PR CI status via `gh pr checks`
 *   4. If all checks pass → merges PR → cleans up worktree/branch → marks task done
 *   5. Handles edge cases: PR already merged, PR closed, checks failing
 */

import type { Task } from '@matanelcohen/openspace-shared';

import type { GitHubService, PRCheckRun } from './index.js';
import type { WorktreeService } from '../sandbox-worktree/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AutoMergeResult {
  taskId: string;
  prNumber: number;
  action: 'merged' | 'pending' | 'skipped' | 'failed' | 'already-merged' | 'closed';
  message: string;
}

export interface PRAutoMergeConfig {
  githubService: GitHubService;
  worktreeService?: WorktreeService;
  tasksDir: string;
  updateTask: (
    tasksDir: string,
    taskId: string,
    updates: Record<string, unknown>,
  ) => Promise<unknown>;
  mergeMethod?: 'squash' | 'merge' | 'rebase';
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class PRAutoMergeService {
  private readonly config: PRAutoMergeConfig;

  constructor(config: PRAutoMergeConfig) {
    this.config = config;
  }

  /** Find tasks that have the `merge:auto` label. */
  findAutoMergeTasks(tasks: Task[]): Task[] {
    return tasks.filter((t) => t.labels.includes('merge:auto'));
  }

  /** Extract PR number from a `pr:<number>` label. */
  extractPRNumber(task: Task): number | null {
    const prLabel = task.labels.find((l) => l.startsWith('pr:'));
    if (!prLabel) return null;
    const num = parseInt(prLabel.split(':')[1]!, 10);
    return isNaN(num) ? null : num;
  }

  /** Returns true when every check has concluded successfully. */
  allChecksPassed(checks: PRCheckRun[]): boolean {
    if (checks.length === 0) return true;
    return checks.every(
      (c) => c.conclusion === 'SUCCESS' || c.state === 'SUCCESS',
    );
  }

  /** Returns true when at least one check is still running. */
  hasChecksPending(checks: PRCheckRun[]): boolean {
    return checks.some((c) => c.state === 'PENDING' || c.conclusion === '');
  }

  /** Process a single task for auto-merge. */
  async processTask(task: Task): Promise<AutoMergeResult> {
    const prNumber = this.extractPRNumber(task);
    if (!prNumber) {
      return {
        taskId: task.id,
        prNumber: 0,
        action: 'skipped',
        message: 'No PR number found in labels',
      };
    }

    // Check PR state
    let pr;
    try {
      pr = await this.config.githubService.getPR(prNumber);
    } catch {
      return {
        taskId: task.id,
        prNumber,
        action: 'failed',
        message: 'Could not fetch PR status',
      };
    }

    // Already merged externally?
    if (pr.state === 'MERGED') {
      await this.onMerged(task);
      return {
        taskId: task.id,
        prNumber,
        action: 'already-merged',
        message: 'PR was merged externally',
      };
    }

    // Closed without merge?
    if (pr.state === 'CLOSED') {
      await this.onClosed(task);
      return {
        taskId: task.id,
        prNumber,
        action: 'closed',
        message: 'PR was closed without merge',
      };
    }

    // Check CI status
    const checks = await this.config.githubService.getPRChecks(prNumber);

    if (this.hasChecksPending(checks)) {
      return {
        taskId: task.id,
        prNumber,
        action: 'pending',
        message: 'Checks still running',
      };
    }

    if (!this.allChecksPassed(checks)) {
      return {
        taskId: task.id,
        prNumber,
        action: 'failed',
        message: 'One or more checks failed',
      };
    }

    // All checks pass — merge!
    try {
      await this.config.githubService.mergePR(
        prNumber,
        this.config.mergeMethod ?? 'squash',
      );
    } catch (err) {
      return {
        taskId: task.id,
        prNumber,
        action: 'failed',
        message: `Merge failed: ${(err as Error).message}`,
      };
    }

    await this.onMerged(task);
    return {
      taskId: task.id,
      prNumber,
      action: 'merged',
      message: 'PR merged successfully',
    };
  }

  /** Process all tasks with the `merge:auto` label. */
  async processAutoMergeTasks(tasks: Task[]): Promise<AutoMergeResult[]> {
    const autoMergeTasks = this.findAutoMergeTasks(tasks);
    const results: AutoMergeResult[] = [];

    for (const task of autoMergeTasks) {
      const result = await this.processTask(task);
      results.push(result);
    }

    return results;
  }

  // ── Private ────────────────────────────────────────────────────

  /** Called after a PR is merged (either by us or externally). */
  private async onMerged(task: Task): Promise<void> {
    const updatedLabels = task.labels
      .filter((l) => l !== 'merge:auto')
      .concat('merged');

    await this.config.updateTask(this.config.tasksDir, task.id, {
      status: 'done',
      labels: updatedLabels,
    });

    // Clean up worktree + branch
    if (this.config.worktreeService) {
      try {
        await this.config.worktreeService.destroy(task.id, {
          deleteBranch: true,
        });
      } catch {
        // Worktree may already be cleaned up
      }
    }
  }

  /** Called when a PR is closed without merge. */
  private async onClosed(task: Task): Promise<void> {
    const updatedLabels = task.labels
      .filter((l) => l !== 'merge:auto')
      .concat('pr-closed');

    await this.config.updateTask(this.config.tasksDir, task.id, {
      status: 'blocked',
      labels: updatedLabels,
    });
  }
}
