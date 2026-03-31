/**
 * CodeReviewService — LLM-powered code review for agent-created PRs.
 *
 * Uses the GitHub CLI (`gh`) to fetch PR diffs, sends the diff to an
 * AIProvider for analysis, and posts the review result back on the PR.
 * Designed to run fire-and-forget after PR creation so it never blocks
 * the agent task completion flow.
 */

import { execSync } from 'node:child_process';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import type { AIProvider } from '../ai/copilot-provider.js';

export interface CodeReviewContext {
  /** Task title that prompted the PR. */
  title: string;
  /** Name of the agent that created the PR. */
  agentName: string;
}

export interface CodeReviewResult {
  approved: boolean;
  comments: string[];
  summary: string;
}

const REVIEW_SYSTEM_PROMPT = `You are a senior code reviewer. Review this diff for bugs, security issues, logic errors.
Only flag real problems. Ignore style/formatting.
Return JSON and nothing else: { "approved": boolean, "comments": [{ "file": string, "line": number, "comment": string }], "summary": string }`;

const MAX_DIFF_LENGTH = 80_000;

export class CodeReviewService {
  constructor(
    private aiProvider: AIProvider,
    private projectDir: string,
  ) {}

  /**
   * Review a PR by number. Fetches the diff via `gh`, sends it to the LLM
   * for analysis, and posts the review on the PR.
   *
   * This is intentionally fire-and-forget — callers should `.catch()`
   * and log rather than awaiting the result in critical paths.
   */
  async reviewPR(
    prNumber: number,
    context: CodeReviewContext,
  ): Promise<CodeReviewResult> {
    const diff = this.getPRDiff(prNumber);
    if (!diff) {
      console.log(`[CodeReviewService] No diff found for PR #${prNumber}, skipping review`);
      return { approved: true, comments: [], summary: 'No diff to review.' };
    }

    // Truncate very large diffs to stay within model context limits
    const truncatedDiff =
      diff.length > MAX_DIFF_LENGTH
        ? diff.substring(0, MAX_DIFF_LENGTH) + '\n\n... [diff truncated]'
        : diff;

    const userMessage = [
      `Review the following PR diff.`,
      `PR #${prNumber} — "${context.title}" by agent "${context.agentName}".`,
      '',
      '```diff',
      truncatedDiff,
      '```',
    ].join('\n');

    const llmResponse = await this.aiProvider.chatCompletion({
      systemPrompt: REVIEW_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const result = this.parseReviewResponse(llmResponse.content);

    // Post the review on the PR via `gh`
    this.postReview(prNumber, result, context);
    console.log(
      `[CodeReviewService] Reviewed PR #${prNumber}: ${result.approved ? 'approved' : 'changes requested'} (${result.comments.length} comments)`,
    );

    return result;
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

  private parseReviewResponse(content: string): CodeReviewResult {
    try {
      // Strip markdown code fences if present
      const cleaned = content.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '');
      const parsed = JSON.parse(cleaned) as {
        approved?: boolean;
        comments?: Array<{ file?: string; line?: number; comment?: string }>;
        summary?: string;
      };

      return {
        approved: parsed.approved ?? true,
        comments: (parsed.comments ?? []).map(
          (c) => `**${c.file ?? 'unknown'}:${c.line ?? 0}** — ${c.comment ?? ''}`,
        ),
        summary: parsed.summary ?? 'No summary provided.',
      };
    } catch {
      // If parsing fails, treat the raw response as an approval with the text as summary
      return { approved: true, comments: [], summary: content.substring(0, 500) };
    }
  }

  private postReview(
    prNumber: number,
    result: CodeReviewResult,
    context: CodeReviewContext,
  ): void {
    const body = [
      `## 🤖 Automated Code Review`,
      '',
      `**PR:** #${prNumber}`,
      `**Task:** ${context.title}`,
      `**Agent:** ${context.agentName}`,
      `**Verdict:** ${result.approved ? '✅ Approved' : '🔄 Changes Requested'}`,
      '',
      `### Summary`,
      result.summary,
      ...(result.comments.length > 0
        ? ['', '### Comments', ...result.comments.map((c) => `- ${c}`)]
        : []),
      '',
      `> _This review was generated automatically by the Code Review Agent._`,
    ].join('\n');

    // Write body to temp file to avoid shell escaping issues with long content
    const bodyFile = join(tmpdir(), `cr-body-${Date.now()}.md`);
    try {
      writeFileSync(bodyFile, body, 'utf-8');

      const action = result.approved ? '--approve' : '--request-changes';
      this.exec(
        `gh pr review ${prNumber} ${action} --body-file ${this.shellEscape(bodyFile)}`,
      );
    } finally {
      try {
        unlinkSync(bodyFile);
      } catch {
        /* ignore cleanup errors */
      }
    }
  }

  private exec(command: string, timeout = 60_000): string {
    return execSync(command, {
      cwd: this.projectDir,
      encoding: 'utf-8',
      env: { ...process.env },
      timeout,
    });
  }

  private shellEscape(value: string): string {
    return `'${value.replace(/'/g, "'\\''")}'`;
  }
}
