/**
 * Tasks connector — reads task .md files from .squad/tasks/.
 *
 * Parses YAML frontmatter for metadata and includes the full
 * markdown body as content for RAG ingestion.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { SourceType } from '@openspace/shared';

import type { ConnectorOptions, SourceConnector, SourceDocument } from './types.js';

export interface TasksConnectorConfig {
  /** Path to the .squad directory. */
  squadDir: string;
}

export class TasksConnector implements SourceConnector {
  readonly sourceType: SourceType = 'task';
  private readonly tasksDir: string;

  constructor(config: TasksConnectorConfig) {
    this.tasksDir = join(config.squadDir, 'tasks');
  }

  async fetchSources(options?: ConnectorOptions): Promise<SourceDocument[]> {
    if (!existsSync(this.tasksDir)) return [];

    const files = readdirSync(this.tasksDir).filter((f) => f.endsWith('.md'));
    const limit = options?.limit ?? files.length;
    const documents: SourceDocument[] = [];

    for (const file of files.slice(0, limit)) {
      try {
        const content = readFileSync(join(this.tasksDir, file), 'utf-8');
        const fm = parseFrontmatter(content);

        // Skip if incremental and not updated since
        if (options?.since && fm.updated && fm.updated < options.since) continue;

        documents.push({
          sourceId: `task-${fm.id ?? file.replace('.md', '')}`,
          sourceType: 'task',
          content,
          metadata: {
            sourceType: 'task' as const,
            sourceId: `task-${fm.id ?? file.replace('.md', '')}`,
            squadPath: `tasks/${file}`,
            filePath: join(this.tasksDir, file),
            agentIds: fm.assignee ? [fm.assignee] : [],
            author: fm.assignee ?? null,
            createdAt: fm.created ?? null,
            updatedAt: fm.updated ?? null,
            tags: fm.labels ?? [],
            status: fm.status ?? null,
            priority: fm.priority ?? null,
            headingPath: null,
            threadId: null,
            sessionId: null,
          },
        });
      } catch {
        // skip unreadable files
      }
    }

    return documents;
  }
}

/** Simple frontmatter parser for task files. */
function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const yaml = match[1]!;
  const result: Record<string, unknown> = {};

  for (const line of yaml.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)/);
    if (kv) {
      let val: unknown = kv[2]!.trim();
      // Strip quotes
      if (typeof val === 'string' && val.startsWith("'") && val.endsWith("'")) {
        val = val.slice(1, -1);
      }
      result[kv[1]!] = val;
    }
    // Parse array items
    if (line.trim().startsWith('- ') && Object.keys(result).length > 0) {
      const lastKey = Object.keys(result).pop()!;
      if (!Array.isArray(result[lastKey])) {
        result[lastKey] = [];
      }
      let item = line.trim().slice(2).trim();
      if (item.startsWith("'") && item.endsWith("'")) item = item.slice(1, -1);
      (result[lastKey] as string[]).push(item);
    }
  }

  return result;
}
