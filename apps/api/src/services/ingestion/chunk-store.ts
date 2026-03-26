/**
 * SQLite-backed chunk store — stores chunks and embeddings in the local database.
 *
 * Implements upsert and delete operations for the RAG ingestion pipeline.
 * Uses the rag_chunks + rag_chunk_embeddings tables from migration v3.
 */

import type Database from 'better-sqlite3';

import type { Chunk, ChunkFilter, EmbeddedChunk, SourceType } from '@openspace/shared';

// ── Chunk Store ────────────────────────────────────────────────────

export class ChunkStore {
  constructor(private readonly db: Database.Database) {}

  /** Upsert chunks (with or without embeddings) into the store. */
  upsertChunks(chunks: Chunk[]): void {
    const upsertStmt = this.db.prepare(`
      INSERT OR REPLACE INTO rag_chunks (
        id, content, token_count,
        source_type, source_id, chunk_index, chunk_total,
        squad_path, file_path, agent_ids, author,
        created_at, updated_at,
        tags, status, priority, heading_path, thread_id, session_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const upsertMany = this.db.transaction((items: Chunk[]) => {
      for (const chunk of items) {
        const m = chunk.metadata;
        upsertStmt.run(
          chunk.id,
          chunk.content,
          chunk.tokenCount,
          m.sourceType,
          m.sourceId,
          m.chunkIndex,
          m.chunkTotal,
          m.squadPath,
          m.filePath,
          JSON.stringify(m.agentIds),
          m.author,
          m.createdAt,
          m.updatedAt,
          JSON.stringify(m.tags),
          m.status,
          m.priority,
          m.headingPath,
          m.threadId,
          m.sessionId,
        );
      }
    });

    upsertMany(chunks);
  }

  /** Upsert embedded chunks (chunks + embedding vectors). */
  upsertEmbeddedChunks(chunks: EmbeddedChunk[]): void {
    this.upsertChunks(chunks);

    const embeddingStmt = this.db.prepare(`
      INSERT OR REPLACE INTO rag_chunk_embeddings (chunk_id, embedding, dimensions, model, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    const upsertEmbeddings = this.db.transaction((items: EmbeddedChunk[]) => {
      for (const chunk of items) {
        const buf = Buffer.from(new Float64Array(chunk.embedding).buffer);
        embeddingStmt.run(
          chunk.id,
          buf,
          chunk.embedding.length,
          'pending', // model set during embedding
          new Date().toISOString(),
        );
      }
    });

    upsertEmbeddings(chunks);
  }

  /** Delete all chunks for a given source. */
  deleteBySource(sourceType: SourceType, sourceId: string): number {
    const result = this.db
      .prepare(`DELETE FROM rag_chunks WHERE source_type = ? AND source_id = ?`)
      .run(sourceType, sourceId);
    return result.changes;
  }

  /** Delete chunks matching a filter. */
  deleteByFilter(filter: ChunkFilter): number {
    const { where, params } = buildWhereClause(filter);
    const result = this.db
      .prepare(`DELETE FROM rag_chunks ${where}`)
      .run(...params);
    return result.changes;
  }

  /** Count chunks, optionally filtered. */
  count(filter?: ChunkFilter): number {
    if (!filter) {
      const row = this.db
        .prepare<[], { cnt: number }>(`SELECT COUNT(*) as cnt FROM rag_chunks`)
        .get();
      return row?.cnt ?? 0;
    }

    const { where, params } = buildWhereClause(filter);
    const row = this.db
      .prepare<unknown[], { cnt: number }>(`SELECT COUNT(*) as cnt FROM rag_chunks ${where}`)
      .get(...params);
    return (row as { cnt: number } | undefined)?.cnt ?? 0;
  }

  /** Count chunks grouped by source type. */
  countBySourceType(): Record<string, number> {
    const rows = this.db
      .prepare<[], { source_type: string; cnt: number }>(
        `SELECT source_type, COUNT(*) as cnt FROM rag_chunks GROUP BY source_type`,
      )
      .all();

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.source_type] = row.cnt;
    }
    return result;
  }
}

// ── Query building ─────────────────────────────────────────────────

function buildWhereClause(filter: ChunkFilter): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.sourceType) {
    conditions.push('source_type = ?');
    params.push(filter.sourceType);
  }

  if (filter.sourceTypes && filter.sourceTypes.length > 0) {
    conditions.push(`source_type IN (${filter.sourceTypes.map(() => '?').join(',')})`);
    params.push(...filter.sourceTypes);
  }

  if (filter.sourceId) {
    conditions.push('source_id = ?');
    params.push(filter.sourceId);
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

  if (filter.status && filter.status.length > 0) {
    conditions.push(`status IN (${filter.status.map(() => '?').join(',')})`);
    params.push(...filter.status);
  }

  if (filter.priority && filter.priority.length > 0) {
    conditions.push(`priority IN (${filter.priority.map(() => '?').join(',')})`);
    params.push(...filter.priority);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}
