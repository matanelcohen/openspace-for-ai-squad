/**
 * Tests for MemoryRecallEngine integration into the AgentWorkerService pipeline.
 *
 * Verifies that memory recall is properly wired: schema initialization,
 * FTS-based retrieval, context block injection into system prompts,
 * and attribution tracking in metadata.
 */

import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

import { MemoryRecallEngine } from '../../memory/memory-recall.js';
import { MemoryStore } from '../../memory/memory-store.js';

// ── Helpers ──────────────────────────────────────────────────────

function createTestDb(): Database.Database {
  const db = new Database(':memory:');

  // Initialize the memory schema (mirrors what the memory-store package does)
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

    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, id, content, type)
      VALUES (new.rowid, new.id, new.content, new.type);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, id, content, type)
      VALUES ('delete', old.rowid, old.id, old.content, old.type);
      INSERT INTO memories_fts(rowid, id, content, type)
      VALUES (new.rowid, new.id, new.content, new.type);
    END;
  `);

  return db;
}

function seedMemories(db: Database.Database, agentId: string): void {
  const now = new Date().toISOString();
  const memories = [
    {
      id: 'mem-1',
      type: 'decision',
      content: 'Project uses TypeScript strict mode with ESM modules',
      strength: 0.9,
    },
    {
      id: 'mem-2',
      type: 'pattern',
      content: 'Services are initialized via constructor injection with a Database instance',
      strength: 0.8,
    },
    {
      id: 'mem-3',
      type: 'preference',
      content: 'Team prefers vitest for unit tests with in-memory SQLite',
      strength: 0.7,
    },
    {
      id: 'mem-4',
      type: 'decision',
      content: 'REST API endpoints follow the /api/v1 prefix convention',
      strength: 0.6,
    },
    {
      id: 'mem-5',
      type: 'pattern',
      content: 'React components use Tailwind CSS for styling',
      strength: 0.5,
    },
  ];

  const stmt = db.prepare(
    `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, strength, enabled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  );

  for (const m of memories) {
    stmt.run(m.id, agentId, m.type, m.content, 'test-session', now, now, m.strength);
  }
}

// ── Tests ────────────────────────────────────────────────────────

describe('Agent Worker — Memory Recall Integration', () => {
  describe('MemoryStore + MemoryRecallEngine wiring', () => {
    it('initializes MemoryStore from a DB with memory schema', () => {
      const db = createTestDb();
      const store = new MemoryStore(db);
      expect(store).toBeDefined();
    });

    it('MemoryRecallEngine.recall returns results from seeded memories', () => {
      const db = createTestDb();
      seedMemories(db, 'bender');

      const store = new MemoryStore(db);
      const engine = new MemoryRecallEngine(store, { maxMemories: 5 });

      const results = engine.recall('bender', 'TypeScript modules');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].score).toBeGreaterThanOrEqual(0.3);
    });

    it('returns empty when no memories exist for the agent', () => {
      const db = createTestDb();
      seedMemories(db, 'bender');

      const store = new MemoryStore(db);
      const engine = new MemoryRecallEngine(store, { maxMemories: 5 });

      // Query for a different agent
      const results = engine.recall('fry', 'TypeScript');
      expect(results).toEqual([]);
    });

    it('returns empty for unrelated queries', () => {
      const db = createTestDb();
      seedMemories(db, 'bender');

      const store = new MemoryStore(db);
      const engine = new MemoryRecallEngine(store, {
        maxMemories: 5,
        relevanceThreshold: 0.8,
      });

      const results = engine.recall('bender', 'quantum physics multiverse');
      // With high threshold, unrelated queries should return few or no results
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0.8);
      }
    });
  });

  describe('buildContextBlock — system prompt injection', () => {
    it('produces a formatted context block with memory tags', () => {
      const db = createTestDb();
      seedMemories(db, 'bender');

      const store = new MemoryStore(db);
      const engine = new MemoryRecallEngine(store, { maxMemories: 5 });

      const results = engine.recall('bender', 'TypeScript ESM modules strict');
      const block = engine.buildContextBlock(results);

      expect(block).not.toBeNull();
      expect(block).toContain('Relevant memories from past sessions');
      // Should contain at least one tagged memory
      expect(block).toMatch(/\[M\d+:(DECISION|PATTERN|PREFERENCE)\]/);
    });

    it('returns null when no memories match', () => {
      const db = createTestDb();
      const store = new MemoryStore(db);
      const engine = new MemoryRecallEngine(store, { maxMemories: 5 });

      const results = engine.recall('nobody', 'nothing');
      expect(engine.buildContextBlock(results)).toBeNull();
    });
  });

  describe('buildAttributions — transparency tracking', () => {
    it('produces attribution records with memory IDs and influence text', () => {
      const db = createTestDb();
      seedMemories(db, 'bender');

      const store = new MemoryStore(db);
      const engine = new MemoryRecallEngine(store, { maxMemories: 5 });

      const results = engine.recall('bender', 'TypeScript');
      const attributions = engine.buildAttributions(results);

      expect(attributions.length).toBe(results.length);
      for (const attr of attributions) {
        expect(attr.memoryId).toBeTruthy();
        expect(attr.influence).toBeTruthy();
        expect(attr.influence).toMatch(/\[M\d+:/);
      }
    });
  });

  describe('recall stats tracking', () => {
    it('updates recall_count and last_recalled_at on recalled memories', () => {
      const db = createTestDb();
      seedMemories(db, 'bender');

      const store = new MemoryStore(db);
      const engine = new MemoryRecallEngine(store, { maxMemories: 5 });

      // Initial state
      const before = db
        .prepare<
          [string],
          { recall_count: number; last_recalled_at: string | null }
        >('SELECT recall_count, last_recalled_at FROM memories WHERE id = ?')
        .get('mem-1');
      expect(before?.recall_count).toBe(0);
      expect(before?.last_recalled_at).toBeNull();

      // Recall
      const results = engine.recall('bender', 'TypeScript strict mode ESM');
      const recalledIds = results.map((r) => r.memory.id);

      // Check that recalled memories got their stats updated
      if (recalledIds.includes('mem-1')) {
        const after = db
          .prepare<
            [string],
            { recall_count: number; last_recalled_at: string | null }
          >('SELECT recall_count, last_recalled_at FROM memories WHERE id = ?')
          .get('mem-1');
        expect(after?.recall_count).toBe(1);
        expect(after?.last_recalled_at).not.toBeNull();
      }
    });
  });

  describe('end-to-end prompt construction', () => {
    it('produces a complete memories prompt suitable for system prompt injection', () => {
      const db = createTestDb();
      seedMemories(db, 'leela');

      const store = new MemoryStore(db);
      const engine = new MemoryRecallEngine(store, { maxMemories: 10 });

      const taskText = 'Implement REST API endpoint for task CRUD with TypeScript';
      const recallResults = engine.recall('leela', taskText);

      let memoriesPrompt = '';
      if (recallResults.length > 0) {
        const contextBlock = engine.buildContextBlock(recallResults);
        if (contextBlock) {
          memoriesPrompt = `## Your Memories & Learnings\n\n${contextBlock}\n\n`;
        }
      }

      // This mirrors the exact pattern used in AgentWorkerService.processNext()
      const systemPrompt =
        `You are Leela, the Lead of the openspace.ai squad.\n\n` +
        (memoriesPrompt ? `${memoriesPrompt}\n` : '') +
        `When done, provide a brief summary of what you did.`;

      expect(systemPrompt).toContain('Leela');
      if (recallResults.length > 0) {
        expect(systemPrompt).toContain('Memories & Learnings');
        expect(systemPrompt).toContain('Relevant memories from past sessions');
      }
    });
  });
});
