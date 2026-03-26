/**
 * SQLite-backed TaskStore for A2A protocol tasks.
 */

import type { Task } from '@a2a-js/sdk';
import type { TaskStore } from '@a2a-js/sdk/server';
import type Database from 'better-sqlite3';

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS a2a_tasks (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`;

/**
 * Persists A2A tasks as serialized JSON in a SQLite table.
 */
export class SqliteTaskStore implements TaskStore {
  private readonly db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
    this.db.exec(CREATE_TABLE_SQL);
  }

  async save(task: Task): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO a2a_tasks (id, data, updated_at) VALUES (?, ?, ?)`,
    );
    stmt.run(task.id, JSON.stringify(task), new Date().toISOString());
  }

  async load(taskId: string): Promise<Task | undefined> {
    const row = this.db.prepare('SELECT data FROM a2a_tasks WHERE id = ?').get(taskId) as
      | { data: string }
      | undefined;
    if (!row) return undefined;
    return JSON.parse(row.data) as Task;
  }
}
