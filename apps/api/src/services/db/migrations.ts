/**
 * Database migrations — version-based schema evolution.
 *
 * Each migration function upgrades from version N to N+1.
 * The current version is stored in `_meta.schema_version`.
 */

import type Database from 'better-sqlite3';

import { migration_v4 } from '../escalation/migration-v4.js';
import { migration_v3 } from '../ingestion/migration-v3.js';

type Migration = (db: Database.Database) => void;

/**
 * Migration 1→2: Memory store enhancement.
 *
 * Adds embedding storage, tags, importance scoring, and TTL support.
 */
const migration_v2: Migration = (db) => {
  // Check if columns already exist before adding (ALTER TABLE doesn't support IF NOT EXISTS)
  const columns = db.prepare('PRAGMA table_info(memories)').all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((c) => c.name));

  if (!columnNames.has('importance')) {
    db.exec(`ALTER TABLE memories ADD COLUMN importance REAL NOT NULL DEFAULT 0.5;`);
  }
  if (!columnNames.has('expires_at')) {
    db.exec(`ALTER TABLE memories ADD COLUMN expires_at TEXT;`);
  }
  if (!columnNames.has('source_task_id_v2')) {
    db.exec(`ALTER TABLE memories ADD COLUMN source_task_id_v2 TEXT;`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_embeddings (
      memory_id   TEXT PRIMARY KEY REFERENCES memories(id) ON DELETE CASCADE,
      embedding   BLOB NOT NULL,
      dimensions  INTEGER NOT NULL,
      model       TEXT NOT NULL,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS memory_tags (
      memory_id  TEXT NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
      tag        TEXT NOT NULL,
      PRIMARY KEY (memory_id, tag)
    );

    CREATE INDEX IF NOT EXISTS idx_memory_tags_tag ON memory_tags(tag);
    CREATE INDEX IF NOT EXISTS idx_memory_embeddings_model ON memory_embeddings(model);
    CREATE INDEX IF NOT EXISTS idx_memories_expires ON memories(expires_at);
    CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance);
  `);
};

/** Ordered list of migrations. Index = target version - 2 (since base schema is v1). */
const MIGRATIONS: Migration[] = [migration_v2, migration_v3, migration_v4];

/** Current target schema version. */
export const TARGET_SCHEMA_VERSION = MIGRATIONS.length + 1;

/**
 * Apply any pending migrations to bring the database to the target version.
 * Safe to call multiple times — skips already-applied migrations.
 */
export function applyMigrations(db: Database.Database): void {
  const row = db
    .prepare<[], { value: string }>(`SELECT value FROM _meta WHERE key = 'schema_version'`)
    .get();

  let currentVersion = row ? parseInt(row.value, 10) : 1;

  if (currentVersion >= TARGET_SCHEMA_VERSION) return;

  // Apply each pending migration in a transaction
  for (let v = currentVersion; v < TARGET_SCHEMA_VERSION; v++) {
    const migration = MIGRATIONS[v - 1]; // v1→v2 is MIGRATIONS[0]
    if (!migration) continue;

    db.transaction(() => {
      migration(db);
      db.prepare(`INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', ?)`).run(
        String(v + 1),
      );
    })();

    currentVersion = v + 1;
  }
}

/**
 * Check whether the memory_embeddings table exists (migration v2 applied).
 */
export function hasEmbeddingSupport(db: Database.Database): boolean {
  const row = db
    .prepare<
      [],
      { name: string }
    >(`SELECT name FROM sqlite_master WHERE type='table' AND name='memory_embeddings'`)
    .get();
  return !!row;
}
