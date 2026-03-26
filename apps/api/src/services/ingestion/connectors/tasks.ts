/**
 * Tasks connector — reads task records from the SQLite database.
 *
 * Formats task title, description, status, priority, and assignee
 * as ingestable documents for the RAG pipeline.
 */

import type Database from 'better-sqlite3';

import type { SourceType } from '@openspace/shared';

import type { ConnectorOptions, SourceConnector, SourceDocument } from './types.js';

// ── DB row type ────────────────────────────────────────────────────

interface TaskRow {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string | null;
  labels: string;
  created_at: string;
  updated_at: string;
}

// ── Content formatting ─────────────────────────────────────────────

function formatTaskContent(task: TaskRow): string {
  const parts: string[] = [];

  parts.push(`# Task: ${task.title}`);
  parts.push(`ID: ${task.id}`);
  parts.push(`Status: ${task.status}`);
  parts.push(`Priority: ${task.priority}`);

  if (task.assignee) {
    parts.push(`Assignee: ${task.assignee}`);
  }

  const labels = parseLabels(task.labels);
  if (labels.length > 0) {
    parts.push(`Labels: ${labels.join(', ')}`);
  }

  parts.push(`Created: ${task.created_at}`);
  parts.push(`Updated: ${task.updated_at}`);

  if (task.description) {
    parts.push('');
    parts.push('## Description');
    parts.push(task.description);
  }

  return parts.join('\n');
}

function parseLabels(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ── Connector ──────────────────────────────────────────────────────

export interface TasksConnectorConfig {
  /** SQLite database instance. */
  db: Database.Database;
}

export class TasksConnector implements SourceConnector {
  readonly sourceType: SourceType = 'task';
  private readonly db: Database.Database;

  constructor(config: TasksConnectorConfig) {
    this.db = config.db;
  }

  async fetchSources(options?: ConnectorOptions): Promise<SourceDocument[]> {
    let query = `SELECT id, title, description, status, priority, assignee, labels, created_at, updated_at
                 FROM tasks ORDER BY updated_at DESC`;

    const params: string[] = [];

    if (options?.since) {
      query = `SELECT id, title, description, status, priority, assignee, labels, created_at, updated_at
               FROM tasks WHERE updated_at >= ? ORDER BY updated_at DESC`;
      params.push(options.since);
    }

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    const rows = params.length > 0
      ? this.db.prepare<[string], TaskRow>(query).all(params[0]!)
      : this.db.prepare<[], TaskRow>(query).all();

    return rows.map((task) => {
      const labels = parseLabels(task.labels);
      return {
        sourceId: `task-${task.id}`,
        sourceType: 'task' as const,
        content: formatTaskContent(task),
        metadata: {
          sourceType: 'task' as const,
          sourceId: `task-${task.id}`,
          squadPath: `tasks/${task.id}.md`,
          filePath: null,
          agentIds: task.assignee ? [task.assignee] : [],
          author: task.assignee,
          createdAt: task.created_at,
          updatedAt: task.updated_at,
          tags: labels,
          status: task.status,
          priority: task.priority,
          headingPath: null,
          threadId: null,
          sessionId: null,
        },
      };
    });
  }
}
