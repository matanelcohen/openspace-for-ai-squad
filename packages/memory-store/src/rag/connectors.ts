/**
 * Ingestion connectors — transform raw source content into chunks.
 *
 * Each connector handles a specific SourceType (commit, pull_request, doc, task)
 * and produces structured ChunkInput objects ready for the chunker.
 */

import type { ChunkMetadata, SourceType } from '@matanelcohen/openspace-shared';

import type { ChunkInput } from './chunker.js';

// ── Base metadata factory ──────────────────────────────────────────

function baseMetadata(
  sourceType: SourceType,
  sourceId: string,
  overrides?: Partial<ChunkMetadata>,
): Omit<ChunkMetadata, 'chunkIndex' | 'chunkTotal'> {
  const now = new Date().toISOString();
  return {
    sourceType,
    sourceId,
    squadPath: null,
    filePath: null,
    agentIds: [],
    author: null,
    createdAt: now,
    updatedAt: now,
    tags: [],
    status: null,
    priority: null,
    headingPath: null,
    threadId: null,
    sessionId: null,
    ...overrides,
  };
}

// ── Commit Connector ───────────────────────────────────────────────

export interface CommitData {
  sha: string;
  message: string;
  author: string;
  date: string;
  diff: string;
  files: string[];
}

/**
 * Ingest a git commit into chunk inputs.
 * Produces a summary chunk (message + file list) and per-file diff chunks.
 */
export function ingestCommit(data: CommitData): ChunkInput[] {
  const inputs: ChunkInput[] = [];
  const shortSha = data.sha.slice(0, 8);

  // Skip empty commits
  if (!data.message.trim() && !data.diff.trim()) {
    return [];
  }

  // Summary chunk: commit message + changed files
  const summary = [
    `Commit ${shortSha}: ${data.message.trim()}`,
    '',
    `Author: ${data.author}`,
    `Date: ${data.date}`,
    '',
    `Changed files:`,
    ...data.files.map((f) => `  - ${f}`),
  ].join('\n');

  inputs.push({
    sourceId: `commit:${data.sha}`,
    content: summary,
    metadata: baseMetadata('commit', data.sha, {
      author: data.author,
      createdAt: data.date,
      updatedAt: data.date,
      tags: ['commit'],
    }),
  });

  // Per-file diff chunks (if diff is present)
  if (data.diff.trim()) {
    const fileDiffs = splitDiffByFile(data.diff);
    for (const [filePath, diffContent] of fileDiffs) {
      if (!diffContent.trim()) continue;
      inputs.push({
        sourceId: `commit:${data.sha}:${filePath}`,
        content: `Diff for ${filePath} (commit ${shortSha}):\n\n${diffContent}`,
        metadata: baseMetadata('commit', data.sha, {
          filePath,
          author: data.author,
          createdAt: data.date,
          updatedAt: data.date,
          tags: ['commit', 'diff'],
        }),
      });
    }
  }

  return inputs;
}

/** Split a unified diff into per-file sections. */
export function splitDiffByFile(diff: string): Map<string, string> {
  const files = new Map<string, string>();
  const sections = diff.split(/^diff --git /m).filter(Boolean);

  for (const section of sections) {
    const headerMatch = section.match(/^a\/(.+?)\s+b\/(.+)/m);
    const filePath = headerMatch?.[2] ?? 'unknown';
    files.set(filePath, section);
  }

  return files;
}

// ── Pull Request Connector ─────────────────────────────────────────

export interface PullRequestData {
  number: number;
  title: string;
  body: string;
  author: string;
  state: 'open' | 'closed' | 'merged';
  createdAt: string;
  updatedAt: string;
  diff: string;
  comments: Array<{ author: string; body: string; createdAt: string }>;
  labels: string[];
  files: string[];
}

/**
 * Ingest a pull request into chunk inputs.
 * Produces: PR summary, PR body, review comments, and diff chunks.
 */
export function ingestPullRequest(data: PullRequestData): ChunkInput[] {
  const inputs: ChunkInput[] = [];
  const prId = `pr:${data.number}`;

  // PR summary
  const summary = [
    `PR #${data.number}: ${data.title}`,
    '',
    `Author: ${data.author}`,
    `State: ${data.state}`,
    `Labels: ${data.labels.join(', ') || 'none'}`,
    `Files changed: ${data.files.length}`,
    '',
    data.body || '(no description)',
  ].join('\n');

  inputs.push({
    sourceId: prId,
    content: summary,
    metadata: baseMetadata('pull_request', String(data.number), {
      author: data.author,
      status: data.state,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      tags: ['pull-request', ...data.labels],
    }),
  });

  // Review comments
  if (data.comments.length > 0) {
    const commentText = data.comments
      .map((c) => `${c.author} (${c.createdAt}):\n${c.body}`)
      .join('\n\n---\n\n');

    inputs.push({
      sourceId: `${prId}:comments`,
      content: `Review comments for PR #${data.number}:\n\n${commentText}`,
      metadata: baseMetadata('pull_request', String(data.number), {
        author: data.author,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        tags: ['pull-request', 'review-comments'],
      }),
    });
  }

  // Diff chunks (per file)
  if (data.diff.trim()) {
    const fileDiffs = splitDiffByFile(data.diff);
    for (const [filePath, diffContent] of fileDiffs) {
      if (!diffContent.trim()) continue;
      inputs.push({
        sourceId: `${prId}:diff:${filePath}`,
        content: `Diff for ${filePath} (PR #${data.number}):\n\n${diffContent}`,
        metadata: baseMetadata('pull_request', String(data.number), {
          filePath,
          author: data.author,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          tags: ['pull-request', 'diff'],
        }),
      });
    }
  }

  return inputs;
}

// ── Doc Connector ──────────────────────────────────────────────────

export interface DocData {
  path: string;
  title: string;
  content: string;
  author: string | null;
  updatedAt: string;
}

/**
 * Ingest a documentation file into chunk inputs.
 * The content is passed directly to the chunker which handles heading-aware splitting.
 */
export function ingestDoc(data: DocData): ChunkInput[] {
  if (!data.content.trim()) {
    return [];
  }

  return [
    {
      sourceId: `doc:${data.path}`,
      content: data.content,
      metadata: baseMetadata('doc', data.path, {
        squadPath: data.path,
        author: data.author,
        updatedAt: data.updatedAt,
        tags: ['documentation'],
      }),
    },
  ];
}

// ── Task Connector ─────────────────────────────────────────────────

export interface TaskData {
  id: string;
  title: string;
  description: string;
  assignee: string | null;
  status: string;
  priority: string | null;
  agentIds: string[];
  createdAt: string;
  updatedAt: string;
  tags: string[];
  progressLog: string[];
}

/**
 * Ingest a task into chunk inputs.
 * Produces a task summary chunk and optionally a progress log chunk.
 */
export function ingestTask(data: TaskData): ChunkInput[] {
  const inputs: ChunkInput[] = [];
  const taskId = `task:${data.id}`;

  // Task summary
  const summary = [
    `Task: ${data.title}`,
    '',
    `Status: ${data.status}`,
    data.priority ? `Priority: ${data.priority}` : '',
    data.assignee ? `Assignee: ${data.assignee}` : '',
    data.agentIds.length > 0 ? `Agents: ${data.agentIds.join(', ')}` : '',
    '',
    data.description || '(no description)',
  ]
    .filter(Boolean)
    .join('\n');

  inputs.push({
    sourceId: taskId,
    content: summary,
    metadata: baseMetadata('task', data.id, {
      agentIds: data.agentIds,
      status: data.status,
      priority: data.priority,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      tags: ['task', ...data.tags],
    }),
  });

  // Progress log (if substantial)
  if (data.progressLog.length > 0) {
    const logText = data.progressLog.map((entry, i) => `${i + 1}. ${entry}`).join('\n');

    inputs.push({
      sourceId: `${taskId}:progress`,
      content: `Progress log for "${data.title}":\n\n${logText}`,
      metadata: baseMetadata('task', data.id, {
        agentIds: data.agentIds,
        status: data.status,
        priority: data.priority,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        tags: ['task', 'progress-log', ...data.tags],
      }),
    });
  }

  return inputs;
}
