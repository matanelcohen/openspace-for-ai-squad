/**
 * SQLite database initialization.
 *
 * Opens (or creates) the SQLite database at `.squad/.cache/openspace.db`
 * and applies the schema. The db file location is configurable via the
 * `DB_PATH` environment variable.
 *
 * SQLite is used as a CACHE. The `.squad/` directory files are the source
 * of truth. On conflict, files win.
 */

import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';

import { initializeSchema } from './schema.js';

export type { Database };

// ── Configuration ──────────────────────────────────────────────────

/** Resolve the database file path. */
function resolveDbPath(squadDir: string): string {
  if (process.env.DB_PATH) return resolve(process.env.DB_PATH);
  return resolve(squadDir, '.cache', 'openspace.db');
}

// ── Public API ─────────────────────────────────────────────────────

export interface OpenDbOptions {
  /** Absolute path to the .squad/ directory. */
  squadDir: string;
  /** If true, use an in-memory database (for tests). */
  inMemory?: boolean;
}

/**
 * Open the SQLite database, ensure parent directories exist,
 * and apply the schema.
 */
export function openDatabase(opts: OpenDbOptions): Database.Database {
  let db: Database.Database;

  if (opts.inMemory) {
    db = new BetterSqlite3(':memory:');
  } else {
    const dbPath = resolveDbPath(opts.squadDir);
    mkdirSync(dirname(dbPath), { recursive: true });
    db = new BetterSqlite3(dbPath);
  }

  // Performance pragmas
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');

  initializeSchema(db);

  return db;
}

// Re-export sub-modules
export { initializeSchema } from './schema.js';
export { searchAll, searchDecisions, type SearchResult,searchTasks } from './search.js';
export { fullSync, incrementalSync } from './sync.js';
