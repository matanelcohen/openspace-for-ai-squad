/**
 * Unit tests for the SQLite vector store.
 *
 * Tests: initialization, upsert, search, delete, count, filters,
 * FTS search, and boundary conditions.
 */

import type { ChunkMetadata, EmbeddedChunk } from '@openspace/shared';
import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SQLiteVectorStore } from '../vector-store.js';

// ── Helpers ────────────────────────────────────────────────────────

function createTestDb(): Database.Database {
  const db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

function makeChunk(
  id: string,
  content: string,
  embedding: number[],
  overrides?: Partial<ChunkMetadata>,
): EmbeddedChunk {
  return {
    id,
    content,
    embedding,
    tokenCount: Math.ceil(content.length / 4),
    metadata: {
      sourceType: 'doc',
      sourceId: 'test-source',
      chunkIndex: 0,
      chunkTotal: 1,
      squadPath: null,
      filePath: null,
      agentIds: [],
      author: null,
      createdAt: '2025-01-15T10:00:00Z',
      updatedAt: '2025-01-15T10:00:00Z',
      tags: [],
      status: null,
      priority: null,
      headingPath: null,
      threadId: null,
      sessionId: null,
      ...overrides,
    },
  };
}

/** Create a normalized random-ish vector for testing. */
function makeVector(seed: number, dims: number = 8): number[] {
  const vec = Array.from({ length: dims }, (_, i) => Math.sin(seed * (i + 1) * 0.7));
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('SQLiteVectorStore', () => {
  let db: Database.Database;
  let store: SQLiteVectorStore;

  beforeEach(async () => {
    db = createTestDb();
    store = new SQLiteVectorStore(db);
    await store.initialize();
  });

  afterEach(() => {
    db.close();
  });

  describe('initialize', () => {
    it('creates required tables', async () => {
      const tables = db
        .prepare<[], { name: string }>(
          `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`,
        )
        .all()
        .map((r) => r.name);

      expect(tables).toContain('rag_chunks');
      expect(tables).toContain('rag_chunk_tags');
      expect(tables).toContain('rag_chunk_agents');
      expect(tables).toContain('rag_ingestion_state');
    });

    it('is safe to call multiple times', async () => {
      await store.initialize();
      await store.initialize();
      const count = await store.count();
      expect(count).toBe(0);
    });
  });

  describe('upsert', () => {
    it('inserts a single chunk', async () => {
      const chunk = makeChunk('c1', 'Hello world', makeVector(1));
      await store.upsert([chunk]);
      expect(await store.count()).toBe(1);
    });

    it('inserts multiple chunks in batch', async () => {
      const chunks = [
        makeChunk('c1', 'First chunk', makeVector(1)),
        makeChunk('c2', 'Second chunk', makeVector(2)),
        makeChunk('c3', 'Third chunk', makeVector(3)),
      ];
      await store.upsert(chunks);
      expect(await store.count()).toBe(3);
    });

    it('updates existing chunk on upsert (same ID)', async () => {
      await store.upsert([makeChunk('c1', 'Original', makeVector(1))]);
      await store.upsert([makeChunk('c1', 'Updated', makeVector(2))]);

      expect(await store.count()).toBe(1);

      const results = await store.search({
        embedding: makeVector(2),
        limit: 1,
        minScore: 0,
      });
      expect(results[0]!.content).toBe('Updated');
    });

    it('stores and retrieves tags', async () => {
      const chunk = makeChunk('c1', 'Tagged chunk', makeVector(1), {
        tags: ['auth', 'security'],
      });
      await store.upsert([chunk]);

      const results = await store.search({
        embedding: makeVector(1),
        limit: 1,
        minScore: 0,
      });
      expect(results[0]!.metadata.tags.sort()).toEqual(['auth', 'security']);
    });

    it('stores and retrieves agent IDs', async () => {
      const chunk = makeChunk('c1', 'Agent chunk', makeVector(1), {
        agentIds: ['agent-1', 'agent-2'],
      });
      await store.upsert([chunk]);

      const results = await store.search({
        embedding: makeVector(1),
        limit: 1,
        minScore: 0,
      });
      expect(results[0]!.metadata.agentIds.sort()).toEqual(['agent-1', 'agent-2']);
    });

    it('handles empty chunks array', async () => {
      await store.upsert([]);
      expect(await store.count()).toBe(0);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await store.upsert([
        makeChunk('c1', 'TypeScript strict mode', makeVector(1)),
        makeChunk('c2', 'SQLite database layer', makeVector(2)),
        makeChunk('c3', 'React component architecture', makeVector(3)),
      ]);
    });

    it('returns results ordered by similarity', async () => {
      const results = await store.search({
        embedding: makeVector(1),
        limit: 10,
        minScore: 0,
      });

      expect(results.length).toBe(3);
      // First result should be most similar to vector(1) -> chunk c1
      expect(results[0]!.id).toBe('c1');
      // Scores should be descending
      for (let i = 1; i < results.length; i++) {
        expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score);
      }
    });

    it('respects limit parameter', async () => {
      const results = await store.search({
        embedding: makeVector(1),
        limit: 1,
        minScore: 0,
      });
      expect(results).toHaveLength(1);
    });

    it('filters by minScore', async () => {
      const results = await store.search({
        embedding: makeVector(1),
        limit: 10,
        minScore: 0.99,
      });

      // Only exact match should pass this threshold
      expect(results.length).toBeLessThanOrEqual(1);
      for (const r of results) {
        expect(r.score).toBeGreaterThanOrEqual(0.99);
      }
    });

    it('filters by sourceType', async () => {
      await store.upsert([
        makeChunk('c-commit', 'A commit', makeVector(10), { sourceType: 'commit' }),
        makeChunk('c-pr', 'A PR', makeVector(11), { sourceType: 'pull_request' }),
      ]);

      const results = await store.search({
        embedding: makeVector(10),
        filter: { sourceType: 'commit' },
        limit: 10,
        minScore: 0,
      });

      expect(results.every((r) => r.metadata.sourceType === 'commit')).toBe(true);
    });

    it('filters by multiple sourceTypes', async () => {
      await store.upsert([
        makeChunk('ct1', 'A commit', makeVector(10), { sourceType: 'commit' }),
        makeChunk('ct2', 'A task', makeVector(11), { sourceType: 'task' }),
        makeChunk('ct3', 'A doc', makeVector(12), { sourceType: 'doc' }),
      ]);

      const results = await store.search({
        embedding: makeVector(10),
        filter: { sourceTypes: ['commit', 'task'] },
        limit: 10,
        minScore: 0,
      });

      for (const r of results) {
        expect(['commit', 'task']).toContain(r.metadata.sourceType);
      }
    });

    it('filters by agentIds', async () => {
      await store.upsert([
        makeChunk('ca1', 'Agent 1 content', makeVector(20), { agentIds: ['agent-1'] }),
        makeChunk('ca2', 'Agent 2 content', makeVector(21), { agentIds: ['agent-2'] }),
      ]);

      const results = await store.search({
        embedding: makeVector(20),
        filter: { agentIds: ['agent-1'] },
        limit: 10,
        minScore: 0,
      });

      expect(results.every((r) => r.metadata.agentIds.includes('agent-1'))).toBe(true);
    });

    it('filters by tags', async () => {
      await store.upsert([
        makeChunk('tag1', 'Auth content', makeVector(30), { tags: ['auth'] }),
        makeChunk('tag2', 'DB content', makeVector(31), { tags: ['database'] }),
      ]);

      const results = await store.search({
        embedding: makeVector(30),
        filter: { tags: ['auth'] },
        limit: 10,
        minScore: 0,
      });

      expect(results.every((r) => r.metadata.tags.includes('auth'))).toBe(true);
    });

    it('filters by date range', async () => {
      await store.upsert([
        makeChunk('d1', 'Old', makeVector(40), { createdAt: '2024-01-01T00:00:00Z' }),
        makeChunk('d2', 'New', makeVector(41), { createdAt: '2025-06-01T00:00:00Z' }),
      ]);

      const results = await store.search({
        embedding: makeVector(40),
        filter: { dateRange: { from: '2025-01-01T00:00:00Z' } },
        limit: 10,
        minScore: 0,
      });

      for (const r of results) {
        expect(r.metadata.createdAt >= '2025-01-01T00:00:00Z').toBe(true);
      }
    });

    it('returns empty for no matches', async () => {
      const emptyDb = createTestDb();
      const emptyStore = new SQLiteVectorStore(emptyDb);
      await emptyStore.initialize();

      const results = await emptyStore.search({
        embedding: makeVector(1),
        limit: 10,
        minScore: 0,
      });
      expect(results).toEqual([]);
      emptyDb.close();
    });
  });

  describe('delete', () => {
    it('deletes chunks by sourceId', async () => {
      await store.upsert([
        makeChunk('d1', 'Content 1', makeVector(1), { sourceId: 'src-1' }),
        makeChunk('d2', 'Content 2', makeVector(2), { sourceId: 'src-2' }),
      ]);

      const deleted = await store.delete({ sourceId: 'src-1' });
      expect(deleted).toBe(1);
      expect(await store.count()).toBe(1);
    });

    it('deletes chunks by sourceType', async () => {
      await store.upsert([
        makeChunk('d1', 'C1', makeVector(1), { sourceType: 'commit' }),
        makeChunk('d2', 'C2', makeVector(2), { sourceType: 'commit' }),
        makeChunk('d3', 'C3', makeVector(3), { sourceType: 'doc' }),
      ]);

      const deleted = await store.delete({ sourceType: 'commit' });
      expect(deleted).toBe(2);
      expect(await store.count()).toBe(1);
    });

    it('returns 0 when no filter conditions match', async () => {
      await store.upsert([makeChunk('d1', 'Content', makeVector(1))]);
      const deleted = await store.delete({ sourceId: 'nonexistent' });
      expect(deleted).toBe(0);
    });

    it('returns 0 for empty filter', async () => {
      await store.upsert([makeChunk('d1', 'Content', makeVector(1))]);
      const deleted = await store.delete({});
      expect(deleted).toBe(0);
    });
  });

  describe('count', () => {
    it('returns 0 for empty store', async () => {
      expect(await store.count()).toBe(0);
    });

    it('returns total count without filter', async () => {
      await store.upsert([
        makeChunk('c1', 'A', makeVector(1)),
        makeChunk('c2', 'B', makeVector(2)),
      ]);
      expect(await store.count()).toBe(2);
    });

    it('returns filtered count', async () => {
      await store.upsert([
        makeChunk('c1', 'A', makeVector(1), { sourceType: 'commit' }),
        makeChunk('c2', 'B', makeVector(2), { sourceType: 'doc' }),
        makeChunk('c3', 'C', makeVector(3), { sourceType: 'doc' }),
      ]);
      expect(await store.count({ sourceType: 'doc' })).toBe(2);
      expect(await store.count({ sourceType: 'commit' })).toBe(1);
      expect(await store.count({ sourceType: 'task' })).toBe(0);
    });
  });

  describe('ftsSearch', () => {
    beforeEach(async () => {
      await store.upsert([
        makeChunk('f1', 'TypeScript strict mode configuration', makeVector(1)),
        makeChunk('f2', 'SQLite database with WAL journal mode', makeVector(2)),
        makeChunk('f3', 'React component lifecycle hooks', makeVector(3)),
      ]);
    });

    it('finds chunks by keyword', () => {
      const results = store.ftsSearch('TypeScript');
      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0]!.id).toBe('f1');
    });

    it('returns empty for non-matching query', () => {
      const results = store.ftsSearch('nonexistentword12345');
      expect(results).toHaveLength(0);
    });

    it('handles special characters in query', () => {
      // Should not throw
      const results = store.ftsSearch('type!@#$%script');
      expect(Array.isArray(results)).toBe(true);
    });

    it('respects limit', () => {
      const results = store.ftsSearch('mode', 1);
      expect(results.length).toBeLessThanOrEqual(1);
    });

    it('returns empty for empty query', () => {
      const results = store.ftsSearch('');
      expect(results).toHaveLength(0);
    });
  });
});
