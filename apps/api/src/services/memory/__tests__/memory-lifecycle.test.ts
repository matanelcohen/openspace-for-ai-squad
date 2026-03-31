/**
 * Tests for MemoryLifecycleService — automated decay, expiration, and consolidation.
 */

import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';

import { MemoryLifecycleService } from '../memory-lifecycle.js';

// ── Helpers ──────────────────────────────────────────────────────

function createTestDb(): Database.Database {
  const db = new Database(':memory:');

  db.exec(`
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

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      id UNINDEXED,
      content,
      type,
      content='memories',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, id, content, type) VALUES (new.rowid, new.id, new.content, new.type);
    END;

    CREATE TABLE IF NOT EXISTS memory_tags (
      memory_id TEXT NOT NULL,
      tag       TEXT NOT NULL,
      PRIMARY KEY (memory_id, tag)
    );
  `);

  return db;
}

let seedCounter = 0;

function seedMemories(
  db: Database.Database,
  agentId: string,
  count: number,
  strength = 1.0,
): void {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, strength, content_hash)
     VALUES (?, ?, 'pattern', ?, 'test', ?, ?, ?, ?)`,
  );
  for (let i = 0; i < count; i++) {
    const uid = seedCounter++;
    stmt.run(`mem-${agentId}-${uid}`, agentId, `Memory ${uid} for ${agentId}`, now, now, strength, `hash-${agentId}-${uid}`);
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('MemoryLifecycleService', () => {
  let lifecycle: MemoryLifecycleService;

  afterEach(() => {
    lifecycle?.stop();
  });

  describe('run', () => {
    it('consolidates a single agent when agentId provided', async () => {
      const db = createTestDb();
      seedMemories(db, 'bender', 5, 0.05); // Below threshold
      seedMemories(db, 'bender', 3, 0.8);  // Above threshold

      lifecycle = new MemoryLifecycleService(db, { runOnStart: false });
      const result = await lifecycle.run('bender');

      expect(result.agents).toHaveProperty('bender');
      expect(result.agents['bender']!.archived).toBe(5);
      expect(result.agents['bender']!.remaining).toBe(3);
      expect(result.totalArchived).toBe(5);
      expect(result.totalRemaining).toBe(3);
    });

    it('consolidates all agents when no agentId', async () => {
      const db = createTestDb();
      seedMemories(db, 'bender', 3, 0.05);
      seedMemories(db, 'fry', 2, 0.05);
      seedMemories(db, 'leela', 4, 0.8);

      lifecycle = new MemoryLifecycleService(db, { runOnStart: false });
      const result = await lifecycle.run();

      expect(Object.keys(result.agents)).toHaveLength(3);
      expect(result.agents['bender']!.archived).toBe(3);
      expect(result.agents['fry']!.archived).toBe(2);
      expect(result.agents['leela']!.archived).toBe(0);
      expect(result.totalArchived).toBe(5);
    });

    it('archives nothing when all memories are strong', async () => {
      const db = createTestDb();
      seedMemories(db, 'bender', 5, 0.9);

      lifecycle = new MemoryLifecycleService(db, { runOnStart: false });
      const result = await lifecycle.run();

      expect(result.totalArchived).toBe(0);
      expect(result.totalRemaining).toBe(5);
    });

    it('handles empty memory store gracefully', async () => {
      const db = createTestDb();

      lifecycle = new MemoryLifecycleService(db, { runOnStart: false });
      const result = await lifecycle.run();

      expect(result.totalArchived).toBe(0);
      expect(result.totalRemaining).toBe(0);
      expect(result.agents).toEqual({});
    });

    it('respects custom archive threshold', async () => {
      const db = createTestDb();
      seedMemories(db, 'bender', 3, 0.3);
      seedMemories(db, 'bender', 2, 0.6);

      lifecycle = new MemoryLifecycleService(db, {
        runOnStart: false,
        archiveThreshold: 0.5,
      });
      const result = await lifecycle.run();

      expect(result.agents['bender']!.archived).toBe(3);
      expect(result.agents['bender']!.remaining).toBe(2);
    });

    it('stores the result accessible via getLastRun', async () => {
      const db = createTestDb();
      seedMemories(db, 'bender', 2, 0.05);

      lifecycle = new MemoryLifecycleService(db, { runOnStart: false });
      expect(lifecycle.getLastRun()).toBeNull();

      await lifecycle.run();
      const lastRun = lifecycle.getLastRun();

      expect(lastRun).not.toBeNull();
      expect(lastRun!.ranAt).toBeDefined();
      expect(lastRun!.totalArchived).toBe(2);
    });
  });

  describe('start/stop', () => {
    it('starts and stops without error', () => {
      const db = createTestDb();
      lifecycle = new MemoryLifecycleService(db, { runOnStart: false, intervalMs: 60000 });

      expect(() => lifecycle.start()).not.toThrow();
      expect(() => lifecycle.stop()).not.toThrow();
    });

    it('can be stopped multiple times safely', () => {
      const db = createTestDb();
      lifecycle = new MemoryLifecycleService(db, { runOnStart: false, intervalMs: 60000 });

      lifecycle.start();
      lifecycle.stop();
      lifecycle.stop(); // Second stop should be safe
    });
  });
});
