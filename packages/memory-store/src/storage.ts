/**
 * Storage layer — SQLite schema, migrations, and low-level DB operations
 * for the memory store.
 *
 * Manages: memories, memory_embeddings, memory_tags tables.
 * Designed to work alongside the existing openspace schema or standalone.
 */

import type Database from 'better-sqlite3';

// ── Schema DDL ─────────────────────────────────────────────────────

const MEMORY_STORE_SCHEMA = `
-- Core memories table
CREATE TABLE IF NOT EXISTS memories (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'decision',
  content          TEXT NOT NULL,
  source_session   TEXT NOT NULL,
  source_task_id   TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  last_recalled_at TEXT,
  enabled          INTEGER NOT NULL DEFAULT 1,
  relevance_score  REAL NOT NULL DEFAULT 0.0,
  recall_count     INTEGER NOT NULL DEFAULT 0,
  strength         REAL NOT NULL DEFAULT 1.0,
  content_hash     TEXT,
  importance       REAL NOT NULL DEFAULT 0.5,
  expires_at       TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_agent     ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_type      ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_enabled   ON memories(enabled);
CREATE INDEX IF NOT EXISTS idx_memories_strength  ON memories(strength);
CREATE INDEX IF NOT EXISTS idx_memories_created   ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_expires   ON memories(expires_at);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
CREATE INDEX IF NOT EXISTS idx_memories_hash      ON memories(content_hash);

-- FTS5 full-text search over memory content
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  id UNINDEXED,
  content,
  type,
  content='memories',
  content_rowid='rowid'
);

CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, id, content, type)
  VALUES (new.rowid, new.id, new.content, new.type);
END;

CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content, type)
  VALUES ('delete', old.rowid, old.id, old.content, old.type);
END;

CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content, type)
  VALUES ('delete', old.rowid, old.id, old.content, old.type);
  INSERT INTO memories_fts(rowid, id, content, type)
  VALUES (new.rowid, new.id, new.content, new.type);
END;

-- Vector embeddings stored as BLOBs
CREATE TABLE IF NOT EXISTS memory_embeddings (
  memory_id   TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
  embedding   BLOB NOT NULL,
  dimensions  INTEGER NOT NULL,
  model       TEXT NOT NULL,
  created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_memory_embeddings_model ON memory_embeddings(model);

-- Tags for categorization
CREATE TABLE IF NOT EXISTS memory_tags (
  memory_id  TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  tag        TEXT NOT NULL,
  PRIMARY KEY (memory_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_memory_tags_tag ON memory_tags(tag);

-- Memory settings (global + per-agent)
CREATE TABLE IF NOT EXISTS memory_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Schema version tracking
CREATE TABLE IF NOT EXISTS _memory_store_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ── Public API ─────────────────────────────────────────────────────

/** Current schema version for the memory store tables. */
export const MEMORY_STORE_SCHEMA_VERSION = 1;

/**
 * Initialize the memory store schema. Safe to call multiple times.
 * Can be used standalone or alongside the main openspace DB.
 */
export function initializeMemorySchema(db: Database.Database): void {
  db.exec(MEMORY_STORE_SCHEMA);
  db.prepare(
    `INSERT OR REPLACE INTO _memory_store_meta (key, value) VALUES ('schema_version', ?)`,
  ).run(String(MEMORY_STORE_SCHEMA_VERSION));
}

/**
 * Check whether the memory store schema has been initialized.
 */
export function hasMemorySchema(db: Database.Database): boolean {
  const row = db
    .prepare<[], { name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='memories'`,
    )
    .get();
  return !!row;
}

/**
 * Check whether embedding support is available.
 */
export function hasEmbeddingSupport(db: Database.Database): boolean {
  const row = db
    .prepare<[], { name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'`,
    )
    .get();
  return !!row;
}

// ── Row Types ──────────────────────────────────────────────────────

export interface MemoryRow {
  id: string;
  agent_id: string;
  type: string;
  content: string;
  source_session: string;
  source_task_id: string | null;
  created_at: string;
  updated_at: string;
  last_recalled_at: string | null;
  enabled: number;
  relevance_score: number;
  recall_count: number;
  strength: number;
  content_hash: string | null;
  importance: number;
  expires_at: string | null;
}

export interface EmbeddingRow {
  memory_id: string;
  embedding: Buffer;
  dimensions: number;
  model: string;
  created_at: string;
}

export interface FtsRecallRow extends MemoryRow {
  rank: number;
}
