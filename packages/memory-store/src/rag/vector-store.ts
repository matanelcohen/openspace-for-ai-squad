/**
 * SQLite-based vector store for the RAG pipeline.
 *
 * Stores embedded chunks in SQLite with BLOB embeddings and FTS5 full-text search.
 * Similarity search is brute-force cosine similarity (suitable for up to ~100k chunks).
 */

import type {
  ChunkFilter,
  EmbeddedChunk,
  SourceType,
  VectorSearchQuery,
  VectorSearchResult,
  VectorStore,
} from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';

// ── Schema ─────────────────────────────────────────────────────────

const RAG_SCHEMA = `
CREATE TABLE IF NOT EXISTS rag_chunks (
  id            TEXT PRIMARY KEY,
  content       TEXT NOT NULL,
  embedding     BLOB NOT NULL,
  dimensions    INTEGER NOT NULL,
  token_count   INTEGER NOT NULL DEFAULT 0,

  source_type   TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  chunk_index   INTEGER NOT NULL DEFAULT 0,
  chunk_total   INTEGER NOT NULL DEFAULT 1,

  squad_path    TEXT,
  file_path     TEXT,
  author        TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,

  status        TEXT,
  priority      TEXT,
  heading_path  TEXT,
  thread_id     TEXT,
  session_id    TEXT
);

CREATE INDEX IF NOT EXISTS idx_rag_source_type ON rag_chunks(source_type);
CREATE INDEX IF NOT EXISTS idx_rag_source_id   ON rag_chunks(source_id);
CREATE INDEX IF NOT EXISTS idx_rag_created     ON rag_chunks(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_file_path   ON rag_chunks(file_path);

-- Tags (many-to-many)
CREATE TABLE IF NOT EXISTS rag_chunk_tags (
  chunk_id  TEXT NOT NULL REFERENCES rag_chunks(id) ON DELETE CASCADE,
  tag       TEXT NOT NULL,
  PRIMARY KEY (chunk_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_rag_tags_tag ON rag_chunk_tags(tag);

-- Agent associations (many-to-many)
CREATE TABLE IF NOT EXISTS rag_chunk_agents (
  chunk_id  TEXT NOT NULL REFERENCES rag_chunks(id) ON DELETE CASCADE,
  agent_id  TEXT NOT NULL,
  PRIMARY KEY (chunk_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_rag_agents_agent ON rag_chunk_agents(agent_id);

-- FTS5 full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
  id UNINDEXED,
  content,
  content='rag_chunks',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS rag_fts_ai AFTER INSERT ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rowid, id, content)
  VALUES (new.rowid, new.id, new.content);
END;

CREATE TRIGGER IF NOT EXISTS rag_fts_ad AFTER DELETE ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, id, content)
  VALUES ('delete', old.rowid, old.id, old.content);
END;

CREATE TRIGGER IF NOT EXISTS rag_fts_au AFTER UPDATE ON rag_chunks BEGIN
  INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, id, content)
  VALUES ('delete', old.rowid, old.id, old.content);
  INSERT INTO rag_chunks_fts(rowid, id, content)
  VALUES (new.rowid, new.id, new.content);
END;

-- Ingestion state tracking
CREATE TABLE IF NOT EXISTS rag_ingestion_state (
  source_type   TEXT NOT NULL,
  source_id     TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  chunk_count   INTEGER NOT NULL DEFAULT 0,
  ingested_at   TEXT NOT NULL,
  PRIMARY KEY (source_type, source_id)
);
`;

// ── Embedding serialization ────────────────────────────────────────

function embeddingToBuffer(embedding: number[]): Buffer {
  const arr = Float64Array.from(embedding);
  return Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength);
}

function bufferToEmbedding(buf: Buffer): number[] {
  const copy = new ArrayBuffer(buf.byteLength);
  new Uint8Array(copy).set(buf);
  return Array.from(new Float64Array(copy));
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ── Row type ───────────────────────────────────────────────────────

interface ChunkRow {
  id: string;
  content: string;
  embedding: Buffer;
  dimensions: number;
  token_count: number;
  source_type: string;
  source_id: string;
  chunk_index: number;
  chunk_total: number;
  squad_path: string | null;
  file_path: string | null;
  author: string | null;
  created_at: string;
  updated_at: string;
  status: string | null;
  priority: string | null;
  heading_path: string | null;
  thread_id: string | null;
  session_id: string | null;
}

// ── SQLiteVectorStore ──────────────────────────────────────────────

export class SQLiteVectorStore implements VectorStore {
  constructor(private readonly db: Database.Database) {}

  async initialize(): Promise<void> {
    this.db.exec(RAG_SCHEMA);
  }

  async upsert(chunks: EmbeddedChunk[]): Promise<void> {
    const upsertChunk = this.db.prepare(`
      INSERT OR REPLACE INTO rag_chunks
        (id, content, embedding, dimensions, token_count,
         source_type, source_id, chunk_index, chunk_total,
         squad_path, file_path, author, created_at, updated_at,
         status, priority, heading_path, thread_id, session_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const deleteTags = this.db.prepare(`DELETE FROM rag_chunk_tags WHERE chunk_id = ?`);
    const insertTag = this.db.prepare(
      `INSERT OR IGNORE INTO rag_chunk_tags (chunk_id, tag) VALUES (?, ?)`,
    );
    const deleteAgents = this.db.prepare(`DELETE FROM rag_chunk_agents WHERE chunk_id = ?`);
    const insertAgent = this.db.prepare(
      `INSERT OR IGNORE INTO rag_chunk_agents (chunk_id, agent_id) VALUES (?, ?)`,
    );

    this.db.transaction(() => {
      for (const chunk of chunks) {
        const m = chunk.metadata;
        const buf = embeddingToBuffer(chunk.embedding);

        upsertChunk.run(
          chunk.id,
          chunk.content,
          buf,
          chunk.embedding.length,
          chunk.tokenCount,
          m.sourceType,
          m.sourceId,
          m.chunkIndex,
          m.chunkTotal,
          m.squadPath,
          m.filePath,
          m.author,
          m.createdAt,
          m.updatedAt,
          m.status,
          m.priority,
          m.headingPath,
          m.threadId,
          m.sessionId,
        );

        // Tags
        deleteTags.run(chunk.id);
        for (const tag of m.tags) {
          insertTag.run(chunk.id, tag);
        }

        // Agents
        deleteAgents.run(chunk.id);
        for (const agentId of m.agentIds) {
          insertAgent.run(chunk.id, agentId);
        }
      }
    })();
  }

  async search(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const limit = query.limit ?? 10;
    const minScore = query.minScore ?? 0.25;

    // Build filter conditions
    const { conditions, params } = this.buildFilterConditions(query.filter);

    const sql =
      conditions.length > 0
        ? `SELECT * FROM rag_chunks WHERE ${conditions.join(' AND ')}`
        : `SELECT * FROM rag_chunks`;

    const rows = this.db.prepare<unknown[], ChunkRow>(sql).all(...params);

    // Compute cosine similarity and rank
    const results: VectorSearchResult[] = [];
    for (const row of rows) {
      const stored = bufferToEmbedding(row.embedding);
      const score = cosineSimilarity(query.embedding, stored);
      if (score < minScore) continue;

      const tags = this.db
        .prepare<[string], { tag: string }>(`SELECT tag FROM rag_chunk_tags WHERE chunk_id = ?`)
        .all(row.id)
        .map((r) => r.tag);
      const agentIds = this.db
        .prepare<[string], { agent_id: string }>(
          `SELECT agent_id FROM rag_chunk_agents WHERE chunk_id = ?`,
        )
        .all(row.id)
        .map((r) => r.agent_id);

      results.push({
        id: row.id,
        score,
        content: row.content,
        metadata: {
          sourceType: row.source_type as SourceType,
          sourceId: row.source_id,
          chunkIndex: row.chunk_index,
          chunkTotal: row.chunk_total,
          squadPath: row.squad_path,
          filePath: row.file_path,
          agentIds,
          author: row.author,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          tags,
          status: row.status,
          priority: row.priority,
          headingPath: row.heading_path,
          threadId: row.thread_id,
          sessionId: row.session_id,
        },
      });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  async delete(filter: ChunkFilter): Promise<number> {
    const { conditions, params } = this.buildFilterConditions(filter);
    if (conditions.length === 0) return 0;

    const sql = `DELETE FROM rag_chunks WHERE ${conditions.join(' AND ')}`;
    const result = this.db.prepare(sql).run(...params);
    return result.changes;
  }

  async count(filter?: ChunkFilter): Promise<number> {
    if (!filter) {
      return this.db.prepare<[], { c: number }>(`SELECT COUNT(*) as c FROM rag_chunks`).get()!.c;
    }
    const { conditions, params } = this.buildFilterConditions(filter);
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db
      .prepare<unknown[], { c: number }>(`SELECT COUNT(*) as c FROM rag_chunks ${where}`)
      .get(...params)!.c;
  }

  // ── FTS search (for hybrid) ──────────────────────────────────────

  ftsSearch(
    queryText: string,
    limit: number = 10,
  ): Array<{ id: string; content: string; rank: number }> {
    const sanitized = queryText
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `"${w}"`)
      .join(' OR ');

    if (!sanitized) return [];

    return this.db
      .prepare<
        [string, number],
        { id: string; content: string; rank: number }
      >(`SELECT id, content, rank FROM rag_chunks_fts WHERE rag_chunks_fts MATCH ? ORDER BY rank LIMIT ?`)
      .all(sanitized, limit);
  }

  // ── Private helpers ──────────────────────────────────────────────

  private buildFilterConditions(filter?: ChunkFilter): { conditions: string[]; params: unknown[] } {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (!filter) return { conditions, params };

    if (filter.sourceType) {
      conditions.push('source_type = ?');
      params.push(filter.sourceType);
    }
    if (filter.sourceTypes?.length) {
      conditions.push(`source_type IN (${filter.sourceTypes.map(() => '?').join(', ')})`);
      params.push(...filter.sourceTypes);
    }
    if (filter.sourceId) {
      conditions.push('source_id = ?');
      params.push(filter.sourceId);
    }
    if (filter.agentIds?.length) {
      conditions.push(
        `id IN (SELECT chunk_id FROM rag_chunk_agents WHERE agent_id IN (${filter.agentIds.map(() => '?').join(', ')}))`,
      );
      params.push(...filter.agentIds);
    }
    if (filter.tags?.length) {
      conditions.push(
        `id IN (SELECT chunk_id FROM rag_chunk_tags WHERE tag IN (${filter.tags.map(() => '?').join(', ')}))`,
      );
      params.push(...filter.tags);
    }
    if (filter.status?.length) {
      conditions.push(`status IN (${filter.status.map(() => '?').join(', ')})`);
      params.push(...filter.status);
    }
    if (filter.priority?.length) {
      conditions.push(`priority IN (${filter.priority.map(() => '?').join(', ')})`);
      params.push(...filter.priority);
    }
    if (filter.dateRange?.from) {
      conditions.push('created_at >= ?');
      params.push(filter.dateRange.from);
    }
    if (filter.dateRange?.to) {
      conditions.push('created_at <= ?');
      params.push(filter.dateRange.to);
    }
    if (filter.squadPath) {
      conditions.push('squad_path = ?');
      params.push(filter.squadPath);
    }
    if (filter.threadId) {
      conditions.push('thread_id = ?');
      params.push(filter.threadId);
    }
    if (filter.sessionId) {
      conditions.push('session_id = ?');
      params.push(filter.sessionId);
    }

    return { conditions, params };
  }
}
