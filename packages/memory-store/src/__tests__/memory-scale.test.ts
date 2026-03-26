/**
 * Scale and performance tests for @openspace/memory-store
 *
 * Validates behavior with large datasets: bulk insert, search performance,
 * batch embedding, pagination, and consolidation at scale.
 */

import BetterSqlite3 from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Embedding, EmbeddingProvider } from '../embedding.js';
import { MemoryStoreService } from '../memory-store.js';
import { initializeMemorySchema } from '../storage.js';

// ── Test Helpers ───────────────────────────────────────────────────

function createFakeEmbeddingProvider(dimensions = 8): EmbeddingProvider {
  return {
    modelId: 'test-model',
    dimensions,
    async embed(text: string): Promise<Embedding> {
      const vec = new Float64Array(dimensions);
      for (let i = 0; i < dimensions; i++) {
        let hash = 0;
        for (let j = 0; j < text.length; j++) {
          hash = ((hash << 5) - hash + text.charCodeAt(j) + i * 31) | 0;
        }
        vec[i] = Math.sin(hash) * 0.5 + 0.5;
      }
      let norm = 0;
      for (let i = 0; i < dimensions; i++) norm += vec[i]! * vec[i]!;
      norm = Math.sqrt(norm);
      if (norm > 0) for (let i = 0; i < dimensions; i++) vec[i]! /= norm;
      return vec;
    },
    async embedBatch(texts: string[]): Promise<Embedding[]> {
      return Promise.all(texts.map((t) => this.embed(t)));
    },
  };
}

function createTestDb(): Database.Database {
  const db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeMemorySchema(db);
  return db;
}

const MEMORY_TYPES = ['decision', 'pattern', 'preference'] as const;

// ── Bulk Insert ────────────────────────────────────────────────────

describe('bulk insert at scale', () => {
  let db: Database.Database;
  let store: MemoryStoreService;

  beforeEach(() => {
    db = createTestDb();
    store = new MemoryStoreService(db, { autoEmbed: false });
  });
  afterEach(() => {
    db.close();
  });

  it('creates 500 unique memories without errors', async () => {
    const ids = new Set<string>();

    for (let i = 0; i < 500; i++) {
      const mem = await store.create({
        agentId: `agent-${i % 5}`, // 5 agents
        type: MEMORY_TYPES[i % 3]!,
        content: `Unique memory content #${i}: ${Date.now()}-${Math.random()}`,
        sourceSession: `session-${i % 10}`,
        tags: [`tag-${i % 7}`],
      });
      ids.add(mem.id);
    }

    // All IDs should be unique
    expect(ids.size).toBe(500);

    const stats = store.stats();
    expect(stats.totalMemories).toBe(500);
    expect(stats.enabledMemories).toBe(500);

    // Verify distribution across agents
    expect(stats.byAgent['agent-0']).toBe(100);
    expect(stats.byAgent['agent-1']).toBe(100);
  });

  it('handles 200 memories with deduplication', async () => {
    // Create 200 memories but only 50 unique contents
    for (let i = 0; i < 200; i++) {
      await store.create({
        agentId: 'a1',
        type: 'decision',
        content: `Repeated decision ${i % 50}`,
        sourceSession: `session-${i}`,
      });
    }

    const stats = store.stats();
    // Should only have 50 unique memories
    expect(stats.enabledMemories).toBe(50);
  });
});

// ── Search at Scale ────────────────────────────────────────────────

describe('search performance at scale', () => {
  let db: Database.Database;
  let store: MemoryStoreService;

  beforeEach(async () => {
    db = createTestDb();
    store = new MemoryStoreService(db, {
      embeddingProvider: createFakeEmbeddingProvider(),
      autoEmbed: true,
    });

    // Seed with 100 memories (with embeddings, so this is realistic)
    for (let i = 0; i < 100; i++) {
      await store.create({
        agentId: 'a1',
        type: MEMORY_TYPES[i % 3]!,
        content: `Technical memory #${i}: covering topics like databases, APIs, architecture, testing, and deployment strategies for modern applications`,
        sourceSession: 's1',
      });
    }
  });
  afterEach(() => {
    db.close();
  });

  it('search completes in reasonable time with 100 embedded memories', async () => {
    const start = performance.now();
    const result = await store.search({
      query: 'database architecture',
      agentId: 'a1',
      topK: 10,
      threshold: 0,
    });
    const elapsed = performance.now() - start;

    expect(result.results.length).toBeLessThanOrEqual(10);
    expect(result.totalSearched).toBe(100);
    // Should complete in under 5 seconds even with in-memory SQLite
    expect(elapsed).toBeLessThan(5000);
  });

  it('search with all filters combined', async () => {
    const result = await store.search({
      query: 'database',
      agentId: 'a1',
      types: ['decision'],
      topK: 5,
      threshold: 0,
    });

    // All results should be decisions
    expect(result.results.every((r) => r.memory.type === 'decision')).toBe(true);
    expect(result.results.length).toBeLessThanOrEqual(5);
  });
});

// ── Batch Embedding at Scale ───────────────────────────────────────

describe('embedAll at scale', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it('backfills 100 memories in batches', async () => {
    // Create without embeddings
    const noEmbedStore = new MemoryStoreService(db, { autoEmbed: false });
    for (let i = 0; i < 100; i++) {
      await noEmbedStore.create({
        agentId: 'a1',
        type: 'decision',
        content: `Unembedded memory ${i} about various technical topics`,
        sourceSession: 's1',
      });
    }

    let stats = noEmbedStore.stats();
    expect(stats.embeddedMemories).toBe(0);

    // Backfill with batch size 50 (needs 2 batches)
    const embedStore = new MemoryStoreService(db, {
      embeddingProvider: createFakeEmbeddingProvider(),
      autoEmbed: true,
    });

    const batch1 = await embedStore.embedAll(50);
    expect(batch1).toBe(50);

    const batch2 = await embedStore.embedAll(50);
    expect(batch2).toBe(50);

    const batch3 = await embedStore.embedAll(50);
    expect(batch3).toBe(0); // Nothing left

    stats = embedStore.stats();
    expect(stats.embeddedMemories).toBe(100);
  });
});

// ── Pagination at Scale ────────────────────────────────────────────

describe('pagination correctness at scale', () => {
  let db: Database.Database;
  let store: MemoryStoreService;

  beforeEach(async () => {
    db = createTestDb();
    store = new MemoryStoreService(db, { autoEmbed: false });

    // Create 50 memories with varying importance
    for (let i = 0; i < 50; i++) {
      await store.create({
        agentId: 'a1',
        type: 'decision',
        content: `Paginated memory number ${i} with unique content`,
        sourceSession: 's1',
        importance: (50 - i) / 50, // decreasing importance
      });
    }
  });
  afterEach(() => {
    db.close();
  });

  it('all pages cover all memories without overlap', () => {
    const pageSize = 10;
    const allIds = new Set<string>();
    let totalFetched = 0;

    for (let offset = 0; offset < 50; offset += pageSize) {
      const page = store.list('a1', pageSize, offset);
      expect(page.length).toBe(pageSize);

      for (const mem of page) {
        expect(allIds.has(mem.id)).toBe(false); // No duplicates
        allIds.add(mem.id);
      }
      totalFetched += page.length;
    }

    expect(totalFetched).toBe(50);
    expect(allIds.size).toBe(50);
  });

  it('pages are ordered by importance DESC', () => {
    const page1 = store.list('a1', 10, 0);
    const page2 = store.list('a1', 10, 10);

    // Last item of page 1 should have higher importance than first of page 2
    expect(page1[page1.length - 1]!.importance).toBeGreaterThanOrEqual(
      page2[0]!.importance,
    );
  });

  it('offset beyond data returns empty', () => {
    const page = store.list('a1', 10, 100);
    expect(page).toHaveLength(0);
  });

  it('last page may have fewer items', () => {
    const page = store.list('a1', 15, 45);
    expect(page).toHaveLength(5); // Only 5 left
  });
});

// ── Consolidation at Scale ─────────────────────────────────────────

describe('consolidation with many agents', () => {
  let db: Database.Database;
  let store: MemoryStoreService;

  beforeEach(async () => {
    db = createTestDb();
    store = new MemoryStoreService(db, { autoEmbed: false });

    // Create memories for 10 agents, 10 each
    for (let a = 0; a < 10; a++) {
      for (let m = 0; m < 10; m++) {
        await store.create({
          agentId: `agent-${a}`,
          type: MEMORY_TYPES[m % 3]!,
          content: `Agent ${a} memory ${m}: unique content here`,
          sourceSession: 's1',
        });
      }
    }
  });
  afterEach(() => {
    db.close();
  });

  it('consolidation per agent is independent', () => {
    // Weaken agent-0 memories
    db.prepare("UPDATE memories SET strength = 0.01 WHERE agent_id = 'agent-0'").run();
    // Weaken agent-1 memories  
    db.prepare("UPDATE memories SET strength = 0.05 WHERE agent_id = 'agent-1'").run();

    const r0 = store.consolidate('agent-0', 0.1);
    expect(r0.archived).toBe(10);
    expect(r0.remaining).toBe(0);

    // Agent-1 should still have its memories
    expect(store.list('agent-1')).toHaveLength(10);

    const r1 = store.consolidate('agent-1', 0.1);
    expect(r1.archived).toBe(10);

    // Other agents unaffected
    for (let a = 2; a < 10; a++) {
      expect(store.list(`agent-${a}`)).toHaveLength(10);
    }
  });

  it('stats reflect large dataset correctly', () => {
    const stats = store.stats();
    expect(stats.totalMemories).toBe(100);
    expect(stats.enabledMemories).toBe(100);
    expect(Object.keys(stats.byAgent)).toHaveLength(10);
    for (let a = 0; a < 10; a++) {
      expect(stats.byAgent[`agent-${a}`]).toBe(10);
    }
  });
});
