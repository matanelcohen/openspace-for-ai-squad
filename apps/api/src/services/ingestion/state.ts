/**
 * Ingestion state tracker — SQLite-backed incremental sync.
 *
 * Tracks content hashes per (sourceType, sourceId) to skip re-processing
 * unchanged data on subsequent ingestion runs.
 */

import type { IngestionState, SourceType } from '@openspace/shared';
import type Database from 'better-sqlite3';

// ── Public API ─────────────────────────────────────────────────────

export class IngestionStateTracker {
  constructor(private readonly db: Database.Database) {}

  /** Check if a source has changed since last ingestion. */
  hasChanged(sourceType: SourceType, sourceId: string, newHash: string): boolean {
    const row = this.db
      .prepare<[string, string], { content_hash: string }>(
        `SELECT content_hash FROM ingestion_state WHERE source_type = ? AND source_id = ?`,
      )
      .get(sourceType, sourceId);

    return !row || row.content_hash !== newHash;
  }

  /** Record that a source was ingested. */
  record(state: IngestionState): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO ingestion_state (source_type, source_id, content_hash, chunk_count, ingested_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(state.sourceType, state.sourceId, state.contentHash, state.chunkCount, state.ingestedAt);
  }

  /** Get ingestion state for a specific source. */
  get(sourceType: SourceType, sourceId: string): IngestionState | null {
    const row = this.db
      .prepare<
        [string, string],
        {
          source_type: string;
          source_id: string;
          content_hash: string;
          chunk_count: number;
          ingested_at: string;
        }
      >(
        `SELECT source_type, source_id, content_hash, chunk_count, ingested_at
         FROM ingestion_state WHERE source_type = ? AND source_id = ?`,
      )
      .get(sourceType, sourceId);

    if (!row) return null;

    return {
      sourceType: row.source_type as SourceType,
      sourceId: row.source_id,
      contentHash: row.content_hash,
      chunkCount: row.chunk_count,
      ingestedAt: row.ingested_at,
    };
  }

  /** Get all ingestion states, optionally filtered by source type. */
  getAll(sourceType?: SourceType): IngestionState[] {
    const query = sourceType
      ? `SELECT * FROM ingestion_state WHERE source_type = ? ORDER BY ingested_at DESC`
      : `SELECT * FROM ingestion_state ORDER BY ingested_at DESC`;

    const rows = sourceType
      ? this.db
          .prepare<
            [string],
            {
              source_type: string;
              source_id: string;
              content_hash: string;
              chunk_count: number;
              ingested_at: string;
            }
          >(query)
          .all(sourceType)
      : this.db
          .prepare<
            [],
            {
              source_type: string;
              source_id: string;
              content_hash: string;
              chunk_count: number;
              ingested_at: string;
            }
          >(query)
          .all();

    return rows.map((row) => ({
      sourceType: row.source_type as SourceType,
      sourceId: row.source_id,
      contentHash: row.content_hash,
      chunkCount: row.chunk_count,
      ingestedAt: row.ingested_at,
    }));
  }

  /** Remove ingestion state for a source (forces re-ingestion next run). */
  remove(sourceType: SourceType, sourceId: string): void {
    this.db
      .prepare(`DELETE FROM ingestion_state WHERE source_type = ? AND source_id = ?`)
      .run(sourceType, sourceId);
  }

  /** Clear all ingestion state (forces full re-ingestion). */
  clear(): void {
    this.db.prepare(`DELETE FROM ingestion_state`).run();
  }

  /** Get count of ingested sources by type. */
  countByType(): Record<string, number> {
    const rows = this.db
      .prepare<[], { source_type: string; cnt: number }>(
        `SELECT source_type, COUNT(*) as cnt FROM ingestion_state GROUP BY source_type`,
      )
      .all();

    const result: Record<string, number> = {};
    for (const row of rows) {
      result[row.source_type] = row.cnt;
    }
    return result;
  }
}
