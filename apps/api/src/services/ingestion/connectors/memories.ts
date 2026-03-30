/**
 * Memories connector — reads agent memories from the SQLite memory store.
 */

import type { SourceType } from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';

import type { ConnectorOptions, SourceConnector, SourceDocument } from './types.js';

interface MemoryRow {
  id: string;
  agent_id: string;
  type: string;
  content: string;
  source_session: string;
  created_at: string;
  updated_at: string;
  tags: string;
}

export interface MemoriesConnectorConfig {
  db: Database.Database;
}

export class MemoriesConnector implements SourceConnector {
  readonly sourceType: SourceType = 'agent_memory';
  private readonly db: Database.Database;

  constructor(config: MemoriesConnectorConfig) {
    this.db = config.db;
  }

  async fetchSources(options?: ConnectorOptions): Promise<SourceDocument[]> {
    let query = `SELECT id, agent_id, type, content, source_session, created_at, updated_at, tags
                 FROM memories WHERE enabled = 1 ORDER BY updated_at DESC`;
    const params: string[] = [];

    if (options?.since) {
      query = `SELECT id, agent_id, type, content, source_session, created_at, updated_at, tags
               FROM memories WHERE enabled = 1 AND updated_at >= ? ORDER BY updated_at DESC`;
      params.push(options.since);
    }

    if (options?.limit) {
      query += ` LIMIT ${options.limit}`;
    }

    let rows: MemoryRow[];
    try {
      rows = params.length > 0
        ? this.db.prepare(query).all(params[0]!) as MemoryRow[]
        : this.db.prepare(query).all() as MemoryRow[];
    } catch {
      return [];
    }

    return rows.map((m) => {
      let tags: string[] = [];
      try { tags = JSON.parse(m.tags); } catch { /* ignore */ }

      return {
        sourceId: `memory-${m.id}`,
        sourceType: 'agent_memory' as const,
        content: `[${m.agent_id}] (${m.type}) ${m.content}`,
        metadata: {
          sourceType: 'agent_memory' as const,
          sourceId: `memory-${m.id}`,
          squadPath: null,
          filePath: null,
          agentIds: [m.agent_id],
          author: m.agent_id,
          createdAt: m.created_at,
          updatedAt: m.updated_at,
          tags,
          status: null,
          priority: null,
          headingPath: null,
          threadId: null,
          sessionId: m.source_session,
        },
      };
    });
  }
}
