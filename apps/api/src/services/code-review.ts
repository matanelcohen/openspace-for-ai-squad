/**
 * CodeReviewService — triggers automated code reviews on agent-created PRs.
 *
 * Uses the GitHub CLI (`gh`) to fetch PR diffs and post review comments.
 * Designed to run fire-and-forget after PR creation so it never blocks
 * the agent task completion flow.
 */

import { execSync } from 'node:child_process';

export interface CodeReviewContext {
  /** Task title that prompted the PR. */
  title: string;
  /** Name of the agent that created the PR. */
  agentName: string;
}

export class CodeReviewService {
  constructor(private projectDir: string) {}

  /**
   * Review a PR by number. Fetches the diff via `gh` and posts a
   * review comment summarising what was changed.
   *
   * This is intentionally fire-and-forget — callers should `.catch()`
   * and log rather than awaiting the result in critical paths.
   */
  async reviewPR(prNumber: number, context: CodeReviewContext): Promise<void> {
    const diff = this.getPRDiff(prNumber);
    if (!diff) {
      console.log(`[CodeReviewService] No diff found for PR #${prNumber}, skipping review`);
      return;
    }

    const summary = this.buildReviewSummary(prNumber, diff, context);
    this.postReviewComment(prNumber, summary);
    console.log(`[CodeReviewService] Posted review on PR #${prNumber}`);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private getPRDiff(prNumber: number): string {
    try {
      return this.exec(`gh pr diff ${prNumber}`);
    } catch {
      return '';
    }
  }

  private buildReviewSummary(
    prNumber: number,
    diff: string,
    context: CodeReviewContext,
  ): string {
    const fileChanges = diff
      .split('\n')
      .filter((l) => l.startsWith('diff --git'))
      .map((l) => {
        const match = l.match(/b\/(.+)$/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    const additions = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
    const deletions = diff.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).length;

    return [
      `## 🤖 Automated Code Review`,
      '',
      `**PR:** #${prNumber}`,
      `**Task:** ${context.title}`,
      `**Agent:** ${context.agentName}`,
      '',
      `### Changes Summary`,
      `- **Files changed:** ${fileChanges.length}`,
      `- **Additions:** +${additions}`,
      `- **Deletions:** -${deletions}`,
      '',
      `### Files`,
      ...fileChanges.map((f) => `- \`${f}\``),
      '',
      `> _This review was generated automatically for agent-created PRs._`,
    ].join('\n');
  }

  private postReviewComment(prNumber: number, body: string): void {
    const escaped = body.replace(/'/g, "'\\''");
    this.exec(`gh pr comment ${prNumber} --body '${escaped}'`);
  }

  private exec(command: string, timeout = 60_000): string {
    return execSync(command, {
      cwd: this.projectDir,
      encoding: 'utf-8',
      env: { ...process.env },
      timeout,
    });
  }
}
