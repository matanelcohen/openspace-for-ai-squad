/**
 * Tests for the SQLite index layer: schema, sync, and search.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { openDatabase } from '../index.js';
import { searchAll, searchDecisions, searchTasks } from '../search.js';
import { fullSync, incrementalSync } from '../sync.js';

// ── Helpers ────────────────────────────────────────────────────────

function createFixtureSquadDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'db-test-'));

  // decisions.md
  writeFileSync(
    join(dir, 'decisions.md'),
    `# Squad Decisions

## Active Decisions

### 2026-03-23T20:42:00Z: PRD created for openspace.ai
**By:** Leela (Lead)
**What:** Created the PRD document.
**Why:** Needed a shared source of truth for scope and architecture.
**Impact:** All agents should read \`docs/prd.md\`.

### 2026-03-23T21:00:00Z: Monorepo structure initialized
**By:** Bender (Backend Dev)
**What:** Initialized the workspace as a Turborepo monorepo.
**Why:** Phase 0 needed a concrete foundation.
**Impact:** P0-2 through P0-7 are unblocked.
`,
  );

  // team.md
  writeFileSync(
    join(dir, 'team.md'),
    `# Team

| Agent | Role | Status |
|-------|------|--------|
| leela | Lead | active |
| bender | Backend Dev | active |
`,
  );

  // config.json
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ name: 'test-squad' }));

  // tasks/
  mkdirSync(join(dir, 'tasks'), { recursive: true });
  writeFileSync(
    join(dir, 'tasks', 'task-001.md'),
    `---
id: task-001
title: Build file watcher
status: in-progress
priority: P1
assignee: bender
labels:
  - backend
  - infrastructure
created: 2026-03-23T21:00:00Z
updated: 2026-03-23T21:00:00Z
sortIndex: 0
---

Implement the chokidar-based file watcher for .squad/ directory monitoring.
`,
  );

  writeFileSync(
    join(dir, 'tasks', 'task-002.md'),
    `---
id: task-002
title: SQLite index layer
status: backlog
priority: P1
assignee: bender
labels:
  - backend
  - database
created: 2026-03-23T21:00:00Z
updated: 2026-03-23T21:00:00Z
sortIndex: 1
---

Set up SQLite as a read-through cache for fast queries and full-text search.
`,
  );

  // agents/
  mkdirSync(join(dir, 'agents', 'bender'), { recursive: true });
  writeFileSync(join(dir, 'agents', 'bender', 'charter.md'), '# Bender\n');

  return dir;
}

/** Create a mock SquadParser that reads from a real fixture directory. */
async function createRealParser(squadDir: string) {
  // Dynamically import the real SquadParser
  const { SquadParser } = await import('../../squad-parser/index.js');
  return new SquadParser(squadDir);
}

// ── Schema tests ───────────────────────────────────────────────────

describe('Database schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = openDatabase({ squadDir: '/tmp/test', inMemory: true });
  });

  afterEach(() => {
    db.close();
  });

  it('should create all required tables', () => {
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    ).all() as Array<{ name: string }>;

    const tableNames = tables.map(t => t.name).sort();
    expect(tableNames).toContain('tasks');
    expect(tableNames).toContain('decisions');
    expect(tableNames).toContain('chat_messages');
    expect(tableNames).toContain('activity_events');
    expect(tableNames).toContain('_meta');
  });

  it('should create FTS5 virtual tables', () => {
    const tables = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%_fts' ORDER BY name`,
    ).all() as Array<{ name: string }>;

    const names = tables.map(t => t.name);
    expect(names).toContain('decisions_fts');
    expect(names).toContain('tasks_fts');
  });

  it('should set schema version in _meta', () => {
    const row = db.prepare(`SELECT value FROM _meta WHERE key = 'schema_version'`).get() as {
      value: string;
    };
    expect(row.value).toBe('1');
  });

  it('should be idempotent (safe to call multiple times)', async () => {
    // openDatabase already called initializeSchema once; call it again
    const { initializeSchema } = await import('../schema.js');
    expect(() => initializeSchema(db)).not.toThrow();
  });

  it('should create proper indexes on tasks', () => {
    const indexes = db.prepare(
      `SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks'`,
    ).all() as Array<{ name: string }>;

    const indexNames = indexes.map(i => i.name);
    expect(indexNames).toContain('idx_tasks_status');
    expect(indexNames).toContain('idx_tasks_assignee');
    expect(indexNames).toContain('idx_tasks_priority');
  });
});

// ── Full sync tests ────────────────────────────────────────────────

describe('fullSync', () => {
  let db: Database.Database;
  let squadDir: string;

  beforeEach(() => {
    squadDir = createFixtureSquadDir();
    db = openDatabase({ squadDir, inMemory: true });
  });

  afterEach(() => {
    db.close();
    rmSync(squadDir, { recursive: true, force: true });
  });

  it('should sync decisions from decisions.md', async () => {
    const parser = await createRealParser(squadDir);
    const result = await fullSync(db, parser);

    expect(result.decisions).toBe(2);

    const rows = db.prepare('SELECT * FROM decisions ORDER BY date').all() as Array<{
      id: string;
      title: string;
      author: string;
    }>;

    expect(rows).toHaveLength(2);
    expect(rows[0]!.title).toBe('PRD created for openspace.ai');
    expect(rows[0]!.author).toBe('Leela (Lead)');
  });

  it('should sync tasks from tasks/*.md', async () => {
    const parser = await createRealParser(squadDir);
    const result = await fullSync(db, parser);

    expect(result.tasks).toBe(2);

    const rows = db.prepare('SELECT * FROM tasks ORDER BY sort_index').all() as Array<{
      id: string;
      title: string;
      status: string;
    }>;

    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe('task-001');
    expect(rows[0]!.title).toBe('Build file watcher');
    expect(rows[0]!.status).toBe('in-progress');
  });

  it('should report duration', async () => {
    const parser = await createRealParser(squadDir);
    const result = await fullSync(db, parser);

    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty tasks directory', async () => {
    rmSync(join(squadDir, 'tasks'), { recursive: true, force: true });
    mkdirSync(join(squadDir, 'tasks'));

    const parser = await createRealParser(squadDir);
    const result = await fullSync(db, parser);

    expect(result.tasks).toBe(0);
  });

  it('should handle missing decisions.md', async () => {
    rmSync(join(squadDir, 'decisions.md'), { force: true });

    const parser = await createRealParser(squadDir);
    const result = await fullSync(db, parser);

    expect(result.decisions).toBe(0);
  });

  it('should replace old data on re-sync', async () => {
    const parser = await createRealParser(squadDir);

    // First sync
    await fullSync(db, parser);
    expect(
      (db.prepare('SELECT COUNT(*) as cnt FROM tasks').get() as { cnt: number }).cnt,
    ).toBe(2);

    // Add a third task
    writeFileSync(
      join(squadDir, 'tasks', 'task-003.md'),
      `---
id: task-003
title: New task
status: backlog
priority: P2
assignee: null
labels: []
created: 2026-03-24T00:00:00Z
updated: 2026-03-24T00:00:00Z
sortIndex: 2
---

A brand new task.
`,
    );

    // Re-sync
    await fullSync(db, parser);
    expect(
      (db.prepare('SELECT COUNT(*) as cnt FROM tasks').get() as { cnt: number }).cnt,
    ).toBe(3);
  });

  it('should update last_full_sync metadata', async () => {
    const parser = await createRealParser(squadDir);
    await fullSync(db, parser);

    const meta = db.prepare(`SELECT value FROM _meta WHERE key = 'last_full_sync'`).get() as {
      value: string;
    };
    expect(meta.value).toBeTruthy();
    // Should be a valid ISO string
    expect(new Date(meta.value).getTime()).not.toBeNaN();
  });
});

// ── Incremental sync tests ─────────────────────────────────────────

describe('incrementalSync', () => {
  let db: Database.Database;
  let squadDir: string;

  beforeEach(async () => {
    squadDir = createFixtureSquadDir();
    db = openDatabase({ squadDir, inMemory: true });

    // Do an initial full sync
    const parser = await createRealParser(squadDir);
    await fullSync(db, parser);
  });

  afterEach(() => {
    db.close();
    rmSync(squadDir, { recursive: true, force: true });
  });

  it('should incrementally sync decisions on decision:added event', async () => {
    // Modify decisions.md to add a new decision
    writeFileSync(
      join(squadDir, 'decisions.md'),
      `# Squad Decisions

## Active Decisions

### 2026-03-23T20:42:00Z: PRD created for openspace.ai
**By:** Leela (Lead)
**What:** Created the PRD document.
**Why:** Needed a shared source of truth.

### 2026-03-23T21:00:00Z: Monorepo structure initialized
**By:** Bender (Backend Dev)
**What:** Initialized workspace.
**Why:** Phase 0 needed foundation.

### 2026-03-24T10:00:00Z: New architecture decision
**By:** Leela (Lead)
**What:** Decided on event-driven architecture.
**Why:** Better decoupling between services.
`,
    );

    const parser = await createRealParser(squadDir);
    const result = await incrementalSync(db, parser, {
      type: 'decision:added',
      path: 'decisions.md',
      timestamp: new Date().toISOString(),
    });

    expect(result.updated).toContain('decision:added');
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM decisions').get() as { cnt: number }).cnt;
    expect(count).toBe(3);
  });

  it('should incrementally sync tasks on task:updated event', async () => {
    // Update task-001
    writeFileSync(
      join(squadDir, 'tasks', 'task-001.md'),
      `---
id: task-001
title: Build file watcher (updated!)
status: done
priority: P1
assignee: bender
labels:
  - backend
created: 2026-03-23T21:00:00Z
updated: 2026-03-24T10:00:00Z
sortIndex: 0
---

Updated description.
`,
    );

    const parser = await createRealParser(squadDir);
    const result = await incrementalSync(db, parser, {
      type: 'task:updated',
      path: 'tasks/task-001.md',
      timestamp: new Date().toISOString(),
    });

    expect(result.updated).toContain('task:updated');

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('task-001') as {
      title: string;
      status: string;
    };
    expect(task.title).toBe('Build file watcher (updated!)');
    expect(task.status).toBe('done');
  });

  it('should incrementally sync tasks on task:created event', async () => {
    writeFileSync(
      join(squadDir, 'tasks', 'task-003.md'),
      `---
id: task-003
title: Brand new task
status: backlog
priority: P2
assignee: null
labels: []
created: 2026-03-24T00:00:00Z
updated: 2026-03-24T00:00:00Z
sortIndex: 2
---

New task body.
`,
    );

    const parser = await createRealParser(squadDir);
    const result = await incrementalSync(db, parser, {
      type: 'task:created',
      path: 'tasks/task-003.md',
      timestamp: new Date().toISOString(),
    });

    expect(result.updated).toContain('task:created');
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM tasks').get() as { cnt: number }).cnt;
    expect(count).toBe(3);
  });

  it('should handle agent:updated events (no-op for db, still records)', async () => {
    const parser = await createRealParser(squadDir);
    const result = await incrementalSync(db, parser, {
      type: 'agent:updated',
      path: 'agents/bender/charter.md',
      timestamp: new Date().toISOString(),
    });

    expect(result.updated).toContain('agent:updated');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle config:changed events', async () => {
    const parser = await createRealParser(squadDir);
    const result = await incrementalSync(db, parser, {
      type: 'config:changed',
      path: 'config.json',
      timestamp: new Date().toISOString(),
    });

    expect(result.updated).toContain('config:changed');
  });

  it('should update last_incremental_sync metadata', async () => {
    const parser = await createRealParser(squadDir);
    await incrementalSync(db, parser, {
      type: 'team:updated',
      path: 'team.md',
      timestamp: new Date().toISOString(),
    });

    const meta = db.prepare(`SELECT value FROM _meta WHERE key = 'last_incremental_sync'`).get() as {
      value: string;
    };
    expect(meta.value).toBeTruthy();
  });
});

// ── Search tests ───────────────────────────────────────────────────

describe('Search', () => {
  let db: Database.Database;
  let squadDir: string;

  beforeEach(async () => {
    squadDir = createFixtureSquadDir();
    db = openDatabase({ squadDir, inMemory: true });

    const parser = await createRealParser(squadDir);
    await fullSync(db, parser);
  });

  afterEach(() => {
    db.close();
    rmSync(squadDir, { recursive: true, force: true });
  });

  describe('searchDecisions', () => {
    it('should find decisions matching a query', () => {
      const results = searchDecisions(db, 'PRD');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.source).toBe('decision');
      expect(results[0]!.title).toContain('PRD');
    });

    it('should find decisions by author', () => {
      const results = searchDecisions(db, 'Bender');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.title).toContain('Monorepo');
    });

    it('should find decisions by rationale content', () => {
      const results = searchDecisions(db, 'foundation');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for no matches', () => {
      const results = searchDecisions(db, 'xyznonexistent');
      expect(results).toHaveLength(0);
    });

    it('should return empty for empty query', () => {
      const results = searchDecisions(db, '');
      expect(results).toHaveLength(0);
    });

    it('should respect the limit parameter', () => {
      const results = searchDecisions(db, 'openspace', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });

  describe('searchTasks', () => {
    it('should find tasks matching a query', () => {
      const results = searchTasks(db, 'file watcher');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.source).toBe('task');
      expect(results[0]!.title).toContain('file watcher');
    });

    it('should find tasks by description content', () => {
      const results = searchTasks(db, 'chokidar');
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should return empty for no matches', () => {
      const results = searchTasks(db, 'xyznonexistent');
      expect(results).toHaveLength(0);
    });

    it('should return empty for empty query', () => {
      const results = searchTasks(db, '   ');
      expect(results).toHaveLength(0);
    });
  });

  describe('searchAll', () => {
    it('should search across both decisions and tasks', () => {
      const results = searchAll(db, 'openspace');
      expect(results.length).toBeGreaterThanOrEqual(1);
      // Should include at least a decision about openspace
      const sources = new Set(results.map(r => r.source));
      expect(sources.has('decision')).toBe(true);
    });

    it('should sort results by relevance', () => {
      const results = searchAll(db, 'backend');
      // All results should have ranks
      for (const r of results) {
        expect(typeof r.rank).toBe('number');
      }
      // Should be sorted by rank ascending
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.rank).toBeGreaterThanOrEqual(results[i - 1]!.rank);
      }
    });

    it('should handle special characters in query', () => {
      // Should not throw on special FTS5 characters
      expect(() => searchAll(db, 'test: "hello" OR world*')).not.toThrow();
    });

    it('should respect the limit parameter', () => {
      const results = searchAll(db, 'the', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });
  });
});
