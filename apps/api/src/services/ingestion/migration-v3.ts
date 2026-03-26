/**
 * Database migration v3: RAG ingestion pipeline tables.
 *
 * Adds:
 *   - ingestion_state: tracks what has been ingested for incremental sync
 *   - rag_chunks: stores chunked content with rich metadata
 *   - rag_chunk_embeddings: stores vector embeddings as BLOBs
 *   - rag_chunks_fts: FTS5 full-text search over chunk content
 */

import type Database from 'better-sqlite3';

export function migration_v3(db: Database.Database): void {
  db.exec(`
    -- Ingestion state — tracks content hashes for incremental sync
    CREATE TABLE IF NOT EXISTS ingestion_state (
      source_type   TEXT NOT NULL,
      source_id     TEXT NOT NULL,
      content_hash  TEXT NOT NULL,
      chunk_count   INTEGER NOT NULL DEFAULT 0,
      ingested_at   TEXT NOT NULL,
      PRIMARY KEY (source_type, source_id)
    );

    CREATE INDEX IF NOT EXISTS idx_ingestion_state_type ON ingestion_state(source_type);
    CREATE INDEX IF NOT EXISTS idx_ingestion_state_ingested ON ingestion_state(ingested_at);

    -- RAG chunks — chunked content with rich metadata
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id           TEXT PRIMARY KEY,
      content      TEXT NOT NULL,
      token_count  INTEGER NOT NULL DEFAULT 0,

      -- Metadata (denormalized for fast filtering)
      source_type  TEXT NOT NULL,
      source_id    TEXT NOT NULL,
      chunk_index  INTEGER NOT NULL DEFAULT 0,
      chunk_total  INTEGER NOT NULL DEFAULT 1,

      squad_path   TEXT,
      file_path    TEXT,
      agent_ids    TEXT NOT NULL DEFAULT '[]',
      author       TEXT,

      created_at   TEXT NOT NULL,
      updated_at   TEXT NOT NULL,

      tags         TEXT NOT NULL DEFAULT '[]',
      status       TEXT,
      priority     TEXT,

      heading_path TEXT,
      thread_id    TEXT,
      session_id   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_rag_chunks_source_type ON rag_chunks(source_type);
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_source_id ON rag_chunks(source_id);
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_author ON rag_chunks(author);
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_created ON rag_chunks(created_at);
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_status ON rag_chunks(status);
    CREATE INDEX IF NOT EXISTS idx_rag_chunks_priority ON rag_chunks(priority);

    -- RAG chunk embeddings — vector storage as BLOBs
    CREATE TABLE IF NOT EXISTS rag_chunk_embeddings (
      chunk_id    TEXT PRIMARY KEY REFERENCES rag_chunks(id) ON DELETE CASCADE,
      embedding   BLOB NOT NULL,
      dimensions  INTEGER NOT NULL,
      model       TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rag_chunk_embeddings_model ON rag_chunk_embeddings(model);

    -- FTS5 full-text search over chunk content
    CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
      id UNINDEXED,
      content,
      source_type,
      content='rag_chunks',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS rag_chunks_ai AFTER INSERT ON rag_chunks BEGIN
      INSERT INTO rag_chunks_fts(rowid, id, content, source_type)
      VALUES (new.rowid, new.id, new.content, new.source_type);
    END;

    CREATE TRIGGER IF NOT EXISTS rag_chunks_ad AFTER DELETE ON rag_chunks BEGIN
      INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, id, content, source_type)
      VALUES ('delete', old.rowid, old.id, old.content, old.source_type);
    END;

    CREATE TRIGGER IF NOT EXISTS rag_chunks_au AFTER UPDATE ON rag_chunks BEGIN
      INSERT INTO rag_chunks_fts(rag_chunks_fts, rowid, id, content, source_type)
      VALUES ('delete', old.rowid, old.id, old.content, old.source_type);
      INSERT INTO rag_chunks_fts(rowid, id, content, source_type)
      VALUES (new.rowid, new.id, new.content, new.source_type);
    END;
  `);
}
