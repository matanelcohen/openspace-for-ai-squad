/**
 * Git commits connector — reads commit history from the local git repo.
 *
 * Extracts commit messages and diffs, formats them as ingestable documents.
 * Uses `git log` for metadata and `git show` for diffs.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { SourceType } from '@matanelcohen/openspace-shared';

import type { ConnectorOptions, SourceConnector, SourceDocument } from './types.js';

const execFileAsync = promisify(execFile);

// ── Git log parsing ────────────────────────────────────────────────

interface GitCommit {
  sha: string;
  author: string;
  date: string;
  message: string;
  files: string[];
}

const COMMIT_SEPARATOR = '---COMMIT_BOUNDARY---';
const FIELD_SEPARATOR = '---FIELD_SEP---';

/**
 * Parse structured git log output into commit objects.
 */
function parseGitLog(output: string): GitCommit[] {
  const commits: GitCommit[] = [];
  const blocks = output.split(COMMIT_SEPARATOR).filter((b) => b.trim());

  for (const block of blocks) {
    const fields = block.split(FIELD_SEPARATOR);
    if (fields.length < 4) continue;

    const sha = fields[0]!.trim();
    const author = fields[1]!.trim();
    const date = fields[2]!.trim();
    const rest = fields[3]!.trim();

    // Message is everything before the file list
    const lines = rest.split('\n');
    const messageLines: string[] = [];
    const files: string[] = [];
    let inFiles = false;

    for (const line of lines) {
      if (line.trim() === '' && messageLines.length > 0) {
        inFiles = true;
        continue;
      }
      if (inFiles && line.trim()) {
        files.push(line.trim());
      } else if (!inFiles) {
        messageLines.push(line);
      }
    }

    commits.push({
      sha,
      author,
      date: new Date(date).toISOString(),
      message: messageLines.join('\n').trim(),
      files,
    });
  }

  return commits;
}

// ── Diff fetching ──────────────────────────────────────────────────

async function getCommitDiff(sha: string, repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['show', '--stat', '--patch', '--no-color', sha, '--'],
      {
        cwd: repoPath,
        maxBuffer: 1024 * 1024, // 1MB per commit diff
        timeout: 10_000,
      },
    );
    // Truncate very large diffs to avoid embedding noise
    const MAX_DIFF_CHARS = 8000;
    if (stdout.length > MAX_DIFF_CHARS) {
      return stdout.slice(0, MAX_DIFF_CHARS) + '\n\n[diff truncated]';
    }
    return stdout;
  } catch {
    return '[diff unavailable]';
  }
}

// ── Connector ──────────────────────────────────────────────────────

export interface GitCommitsConnectorConfig {
  /** Path to the git repository. */
  repoPath: string;
  /** Include diffs in the content (increases token usage). Default: true. */
  includeDiffs?: boolean;
  /** Max number of commits to fetch. Default: 500. */
  maxCommits?: number;
}

export class GitCommitsConnector implements SourceConnector {
  readonly sourceType: SourceType = 'commit';
  private readonly repoPath: string;
  private readonly includeDiffs: boolean;
  private readonly maxCommits: number;

  constructor(config: GitCommitsConnectorConfig) {
    this.repoPath = config.repoPath;
    this.includeDiffs = config.includeDiffs ?? true;
    this.maxCommits = config.maxCommits ?? 500;
  }

  async fetchSources(options?: ConnectorOptions): Promise<SourceDocument[]> {
    const limit = options?.limit ?? this.maxCommits;
    const args = [
      'log',
      `--max-count=${limit}`,
      `--format=${COMMIT_SEPARATOR}%H${FIELD_SEPARATOR}%an${FIELD_SEPARATOR}%aI${FIELD_SEPARATOR}%B`,
      '--name-only',
      '--no-color',
    ];

    if (options?.since) {
      args.push(`--since=${options.since}`);
    }

    const { stdout } = await execFileAsync('git', args, {
      cwd: this.repoPath,
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: 30_000,
    });

    const commits = parseGitLog(stdout);
    const documents: SourceDocument[] = [];

    for (const commit of commits) {
      let content = `Commit: ${commit.sha}\nAuthor: ${commit.author}\nDate: ${commit.date}\n\n${commit.message}`;

      if (commit.files.length > 0) {
        content += `\n\nFiles changed:\n${commit.files.map((f) => `  - ${f}`).join('\n')}`;
      }

      if (this.includeDiffs) {
        const diff = await getCommitDiff(commit.sha, this.repoPath);
        content += `\n\n--- Diff ---\n${diff}`;
      }

      documents.push({
        sourceId: commit.sha,
        sourceType: 'commit',
        content,
        metadata: {
          sourceType: 'commit',
          sourceId: commit.sha,
          squadPath: null,
          filePath: commit.files[0] ?? null,
          agentIds: [],
          author: commit.author,
          createdAt: commit.date,
          updatedAt: commit.date,
          tags: [],
          status: null,
          priority: null,
          headingPath: null,
          threadId: null,
          sessionId: null,
        },
      });
    }

    return documents;
  }
}
