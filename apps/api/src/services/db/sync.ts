/**
 * Sync logic — keeps SQLite in sync with `.squad/` files.
 *
 * Two modes:
 *   fullSync()        — On startup: wipes and re-indexes everything from files
 *   incrementalSync() — On file change: updates only the affected records
 *
 * SQLite is the CACHE. .squad/ files are the source of truth.
 * If they conflict, files win.
 */

import type { ChatChannel, Task } from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';

import type { FileWatcherEvent, FileWatcherEventType } from '../file-watcher/index.js';
import type { SquadParser } from '../squad-parser/index.js';

// ── Full sync ──────────────────────────────────────────────────────

export interface FullSyncResult {
  tasks: number;
  decisions: number;
  channels: number;
  durationMs: number;
}

/**
 * Perform a full sync: clear all cached data and re-index from .squad/ files.
 * Called on startup to ensure the cache matches the filesystem.
 */
export async function fullSync(
  db: Database.Database,
  parser: SquadParser,
): Promise<FullSyncResult> {
  const start = Date.now();

  const [decisions, tasks, channels] = await Promise.all([
    parser.getDecisions(),
    loadTasks(parser),
    parser.getChannels(),
  ]);

  // Run the sync in a transaction for atomicity
  const syncTransaction = db.transaction(() => {
    // Clear existing data (FTS triggers will handle cleanup)
    db.prepare('DELETE FROM decisions').run();
    db.prepare('DELETE FROM tasks').run();
    db.prepare('DELETE FROM chat_channels').run();

    // Re-insert decisions
    const insertDecision = db.prepare(`
      INSERT INTO decisions (id, title, author, date, rationale, status, affected_files)
      VALUES (@id, @title, @author, @date, @rationale, @status, @affectedFiles)
    `);

    for (const d of decisions) {
      insertDecision.run({
        id: d.id,
        title: d.title,
        author: d.author,
        date: d.date,
        rationale: d.rationale,
        status: d.status,
        affectedFiles: JSON.stringify(d.affectedFiles),
      });
    }

    // Re-insert tasks
    const insertTask = db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, assignee, labels, created_at, updated_at, sort_index)
      VALUES (@id, @title, @description, @status, @priority, @assignee, @labels, @createdAt, @updatedAt, @sortIndex)
    `);

    for (const t of tasks) {
      insertTask.run({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee,
        labels: JSON.stringify(t.labels),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        sortIndex: t.sortIndex,
      });
    }

    // Re-insert channels
    const insertChannel = db.prepare(`
      INSERT INTO chat_channels (id, name, description, member_agent_ids, created_at, updated_at)
      VALUES (@id, @name, @description, @memberAgentIds, @createdAt, @updatedAt)
    `);

    for (const c of channels) {
      insertChannel.run({
        id: c.id,
        name: c.name,
        description: c.description,
        memberAgentIds: JSON.stringify(c.memberAgentIds),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      });
    }

    // Update sync timestamp
    db.prepare(
      `INSERT OR REPLACE INTO _meta (key, value) VALUES ('last_full_sync', @ts)`,
    ).run({ ts: new Date().toISOString() });
  });

  syncTransaction();

  return {
    tasks: tasks.length,
    decisions: decisions.length,
    channels: channels.length,
    durationMs: Date.now() - start,
  };
}

// ── Incremental sync ───────────────────────────────────────────────

export interface IncrementalSyncResult {
  updated: FileWatcherEventType[];
  durationMs: number;
}

/**
 * Incrementally update the database in response to a file watcher event.
 * Only re-indexes the data affected by the change.
 */
export async function incrementalSync(
  db: Database.Database,
  parser: SquadParser,
  event: FileWatcherEvent,
): Promise<IncrementalSyncResult> {
  const start = Date.now();
  const updated: FileWatcherEventType[] = [];

  switch (event.type) {
    case 'decision:added': {
      await syncDecisions(db, parser);
      updated.push('decision:added');
      break;
    }

    case 'task:created':
    case 'task:updated': {
      await syncTasks(db, parser);
      updated.push(event.type);
      break;
    }

    case 'channel:created':
    case 'channel:updated':
    case 'channel:deleted': {
      await syncChannels(db, parser);
      updated.push(event.type);
      break;
    }

    // For agent, config, and team changes, we don't have dedicated tables
    // but we record the event type as processed
    case 'agent:updated':
    case 'config:changed':
    case 'team:updated': {
      updated.push(event.type);
      break;
    }
  }

  // Update incremental sync timestamp
  db.prepare(
    `INSERT OR REPLACE INTO _meta (key, value) VALUES ('last_incremental_sync', @ts)`,
  ).run({ ts: new Date().toISOString() });

  return {
    updated,
    durationMs: Date.now() - start,
  };
}

// ── Private helpers ────────────────────────────────────────────────

async function loadTasks(parser: SquadParser): Promise<Task[]> {
  // SquadParser doesn't have a getTasks() yet (P1-3).
  // We import the task parser directly for now.
  try {
    const { parseAllTasks } = await import('../squad-parser/task-parser.js');
    const tasksDir = parser.getSquadDir() + '/tasks';
    const result = await parseAllTasks(tasksDir);
    return result.tasks.map(r => r.task);
  } catch {
    return [];
  }
}

/** Re-sync all decisions from files → db. */
async function syncDecisions(
  db: Database.Database,
  parser: SquadParser,
): Promise<void> {
  const decisions = await parser.getDecisions();

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM decisions').run();

    const insert = db.prepare(`
      INSERT INTO decisions (id, title, author, date, rationale, status, affected_files)
      VALUES (@id, @title, @author, @date, @rationale, @status, @affectedFiles)
    `);

    for (const d of decisions) {
      insert.run({
        id: d.id,
        title: d.title,
        author: d.author,
        date: d.date,
        rationale: d.rationale,
        status: d.status,
        affectedFiles: JSON.stringify(d.affectedFiles),
      });
    }
  });

  transaction();
}

/** Re-sync all tasks from files → db. */
async function syncTasks(
  db: Database.Database,
  parser: SquadParser,
): Promise<void> {
  const tasks = await loadTasks(parser);

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM tasks').run();

    const insert = db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, assignee, labels, created_at, updated_at, sort_index)
      VALUES (@id, @title, @description, @status, @priority, @assignee, @labels, @createdAt, @updatedAt, @sortIndex)
    `);

    for (const t of tasks) {
      insert.run({
        id: t.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee,
        labels: JSON.stringify(t.labels),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        sortIndex: t.sortIndex,
      });
    }
  });

  transaction();
}

/** Re-sync all channels from files → db. */
async function syncChannels(
  db: Database.Database,
  parser: SquadParser,
): Promise<void> {
  const channels = await parser.getChannels();

  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM chat_channels').run();

    const insert = db.prepare(`
      INSERT INTO chat_channels (id, name, description, member_agent_ids, created_at, updated_at)
      VALUES (@id, @name, @description, @memberAgentIds, @createdAt, @updatedAt)
    `);

    for (const c of channels) {
      insert.run({
        id: c.id,
        name: c.name,
        description: c.description,
        memberAgentIds: JSON.stringify(c.memberAgentIds),
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      });
    }
  });

  transaction();
}
