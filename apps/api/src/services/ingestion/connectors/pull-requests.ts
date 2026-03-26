/**
 * Pull requests connector — fetches PR data via the GitHub CLI (`gh`).
 *
 * Extracts title, description, review comments, and merge status.
 * Requires `gh` CLI authenticated and available in PATH.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { SourceType } from '@openspace/shared';

import type { ConnectorOptions, SourceConnector, SourceDocument } from './types.js';

const execFileAsync = promisify(execFile);

// ── GitHub CLI types ───────────────────────────────────────────────

interface GitHubPR {
  number: number;
  title: string;
  body: string;
  author: { login: string };
  state: string;
  createdAt: string;
  updatedAt: string;
  mergedAt: string | null;
  labels: Array<{ name: string }>;
  files: Array<{ path: string }>;
  reviews: Array<{
    author: { login: string };
    body: string;
    state: string;
    submittedAt: string;
  }>;
  comments: Array<{
    author: { login: string };
    body: string;
    createdAt: string;
  }>;
}

// ── PR fetching ────────────────────────────────────────────────────

async function fetchPullRequests(
  repoPath: string,
  limit: number,
  since?: string,
): Promise<GitHubPR[]> {
  const args = [
    'pr',
    'list',
    '--state=all',
    `--limit=${limit}`,
    '--json=number,title,body,author,state,createdAt,updatedAt,mergedAt,labels,files,reviews,comments',
  ];

  try {
    const { stdout } = await execFileAsync('gh', args, {
      cwd: repoPath,
      maxBuffer: 20 * 1024 * 1024, // 20MB
      timeout: 60_000,
    });

    const prs: GitHubPR[] = JSON.parse(stdout);

    // Filter by date if `since` is specified
    if (since) {
      const sinceDate = new Date(since);
      return prs.filter((pr) => new Date(pr.updatedAt) >= sinceDate);
    }

    return prs;
  } catch (err) {
    // gh CLI not available or not authenticated — return empty
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('ENOENT') || message.includes('not found') || message.includes('auth')) {
      console.warn(`[pull-requests] gh CLI unavailable or not authenticated: ${message}`);
      return [];
    }
    throw err;
  }
}

// ── Content formatting ─────────────────────────────────────────────

function formatPRContent(pr: GitHubPR): string {
  const parts: string[] = [];

  // Header
  parts.push(`# PR #${pr.number}: ${pr.title}`);
  parts.push(`Author: ${pr.author.login}`);
  parts.push(`State: ${pr.state}${pr.mergedAt ? ` (merged ${pr.mergedAt})` : ''}`);
  parts.push(`Created: ${pr.createdAt}`);

  if (pr.labels.length > 0) {
    parts.push(`Labels: ${pr.labels.map((l) => l.name).join(', ')}`);
  }

  // Description
  if (pr.body) {
    parts.push('');
    parts.push('## Description');
    parts.push(pr.body);
  }

  // Files changed
  if (pr.files.length > 0) {
    parts.push('');
    parts.push('## Files Changed');
    parts.push(pr.files.map((f) => `- ${f.path}`).join('\n'));
  }

  // Reviews
  const substantiveReviews = pr.reviews.filter((r) => r.body.trim());
  if (substantiveReviews.length > 0) {
    parts.push('');
    parts.push('## Reviews');
    for (const review of substantiveReviews) {
      parts.push(`### ${review.author.login} (${review.state})`);
      parts.push(review.body);
    }
  }

  // Comments
  const substantiveComments = pr.comments.filter((c) => c.body.trim());
  if (substantiveComments.length > 0) {
    parts.push('');
    parts.push('## Discussion');
    for (const comment of substantiveComments) {
      parts.push(`**${comment.author.login}** (${comment.createdAt}):`);
      parts.push(comment.body);
      parts.push('');
    }
  }

  return parts.join('\n');
}

// ── Connector ──────────────────────────────────────────────────────

export interface PullRequestsConnectorConfig {
  /** Path to the git repository. */
  repoPath: string;
  /** Max PRs to fetch per run. Default: 100. */
  maxPRs?: number;
}

export class PullRequestsConnector implements SourceConnector {
  readonly sourceType: SourceType = 'pull_request';
  private readonly repoPath: string;
  private readonly maxPRs: number;

  constructor(config: PullRequestsConnectorConfig) {
    this.repoPath = config.repoPath;
    this.maxPRs = config.maxPRs ?? 100;
  }

  async fetchSources(options?: ConnectorOptions): Promise<SourceDocument[]> {
    const limit = options?.limit ?? this.maxPRs;
    const prs = await fetchPullRequests(this.repoPath, limit, options?.since);

    return prs.map((pr) => ({
      sourceId: `pr-${pr.number}`,
      sourceType: 'pull_request' as const,
      content: formatPRContent(pr),
      metadata: {
        sourceType: 'pull_request' as const,
        sourceId: `pr-${pr.number}`,
        squadPath: null,
        filePath: pr.files[0]?.path ?? null,
        agentIds: [],
        author: pr.author.login,
        createdAt: pr.createdAt,
        updatedAt: pr.updatedAt,
        tags: pr.labels.map((l) => l.name),
        status: pr.state,
        priority: null,
        headingPath: null,
        threadId: null,
        sessionId: null,
      },
    }));
  }
}
