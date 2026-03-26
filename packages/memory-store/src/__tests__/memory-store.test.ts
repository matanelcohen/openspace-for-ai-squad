/**
 * Tests for @openspace/memory-store
 */

import BetterSqlite3 from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Embedding, EmbeddingProvider } from '../embedding.js';
import {
  bufferToEmbedding,
  cosineSimilarity,
  embeddingToBuffer,
} from '../embedding.js';
import {
  calculateImportance,
  contentHash,
  decayFactor,
} from '../lifecycle.js';
import { MemoryStoreService } from '../memory-store.js';
import { initializeMemorySchema } from '../storage.js';

// ── Test Helpers ───────────────────────────────────────────────────

/** Deterministic fake embedding provider for tests. */
function createFakeEmbeddingProvider(dimensions = 8): EmbeddingProvider {
  return {
    modelId: 'test-model',
    dimensions,
    async embed(text: string): Promise<Embedding> {
      // Hash-based deterministic embedding
      const vec = new Float64Array(dimensions);
      for (let i = 0; i < dimensions; i++) {
        let hash = 0;
        for (let j = 0; j < text.length; j++) {
          hash = ((hash << 5) - hash + text.charCodeAt(j) + i * 31) | 0;
        }
        vec[i] = Math.sin(hash) * 0.5 + 0.5;
      }
      // Normalize
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

// ── Embedding Tests ────────────────────────────────────────────────

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [1, 2, 3, 4];
    expect(cosineSimilarity(v, v)).toBeCloseTo(1.0);
  });

  it('returns 0 for orthogonal vectors', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0.0);
  });

  it('returns -1 for opposite vectors', () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1.0);
  });

  it('throws on dimension mismatch', () => {
    expect(() => cosineSimilarity([1, 2], [1, 2, 3])).toThrow('Dimension mismatch');
  });

  it('returns 0 for zero vectors', () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe('embedding serialization', () => {
  it('roundtrips Float64Array through Buffer', () => {
    const original = Float64Array.from([0.1, 0.2, 0.3, -0.5, 1.0]);
    const buf = embeddingToBuffer(original);
    const restored = bufferToEmbedding(buf);

    expect(restored.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i]!);
    }
  });

  it('roundtrips number array through Buffer', () => {
    const original = [0.1, -0.2, 0.3];
    const buf = embeddingToBuffer(original);
    const restored = bufferToEmbedding(buf);

    expect(restored.length).toBe(original.length);
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i]!);
    }
  });
});

// ── Lifecycle Tests ────────────────────────────────────────────────

describe('contentHash', () => {
  it('produces consistent hashes', () => {
    expect(contentHash('hello world')).toBe(contentHash('hello world'));
  });

  it('normalizes case and whitespace', () => {
    expect(contentHash('  Hello World  ')).toBe(contentHash('hello world'));
  });

  it('differentiates different content', () => {
    expect(contentHash('hello')).not.toBe(contentHash('world'));
  });
});

describe('calculateImportance', () => {
  it('scores decisions higher than preferences', () => {
    const decision = calculateImportance('A technical decision was made', 'decision', false);
    const preference = calculateImportance('A user preference was noted', 'preference', false);
    expect(decision).toBeGreaterThan(preference);
  });

  it('gives a bonus for memories with source tasks', () => {
    const withTask = calculateImportance('Some memory content', 'pattern', true);
    const withoutTask = calculateImportance('Some memory content', 'pattern', false);
    expect(withTask).toBeGreaterThan(withoutTask);
  });

  it('penalizes very short content', () => {
    const short = calculateImportance('hi', 'decision', false);
    const normal = calculateImportance('A reasonable decision about architecture', 'decision', false);
    expect(normal).toBeGreaterThan(short);
  });
});

describe('decayFactor', () => {
  it('returns 1 for 0 elapsed days', () => {
    expect(decayFactor(0, 90)).toBeCloseTo(1.0);
  });

  it('returns 0.5 at the half-life', () => {
    expect(decayFactor(90, 90)).toBeCloseTo(0.5);
  });

  it('returns 0.25 at double the half-life', () => {
    expect(decayFactor(180, 90)).toBeCloseTo(0.25);
  });
});

// ── MemoryStoreService Tests ───────────────────────────────────────

describe('MemoryStoreService', () => {
  let db: Database.Database;
  let store: MemoryStoreService;

  beforeEach(() => {
    db = createTestDb();
    store = new MemoryStoreService(db, { autoEmbed: false });
  });

  afterEach(() => {
    db.close();
  });

  describe('create', () => {
    it('creates a memory with generated ID', async () => {
      const mem = await store.create({
        agentId: 'agent-1',
        type: 'decision',
        content: 'Use Fastify for the API layer',
        sourceSession: 'session-1',
      });

      expect(mem.id).toMatch(/^mem-/);
      expect(mem.content).toBe('Use Fastify for the API layer');
      expect(mem.type).toBe('decision');
      expect(mem.enabled).toBe(true);
      expect(mem.tags).toEqual([]);
      expect(mem.hasEmbedding).toBe(false);
    });

    it('creates a memory with tags', async () => {
      const mem = await store.create({
        agentId: 'agent-1',
        type: 'pattern',
        content: 'Services use constructor DI',
        sourceSession: 'session-1',
        tags: ['architecture', 'di'],
      });

      expect(mem.tags).toEqual(['architecture', 'di']);
    });

    it('creates a memory with TTL', async () => {
      const mem = await store.create({
        agentId: 'agent-1',
        type: 'preference',
        content: 'Temporary preference',
        sourceSession: 'session-1',
        ttlSeconds: 3600,
      });

      expect(mem.expiresAt).toBeTruthy();
      const expires = new Date(mem.expiresAt!);
      const now = new Date();
      expect(expires.getTime() - now.getTime()).toBeGreaterThan(3500 * 1000);
    });

    it('deduplicates by content hash and boosts strength', async () => {
      const first = await store.create({
        agentId: 'agent-1',
        type: 'decision',
        content: 'Use TypeScript strict mode',
        sourceSession: 'session-1',
      });

      // Manually lower strength so boost is visible
      db.prepare('UPDATE memories SET strength = 0.5 WHERE id = ?').run(first.id);

      const second = await store.create({
        agentId: 'agent-1',
        type: 'decision',
        content: 'Use TypeScript strict mode',
        sourceSession: 'session-2',
      });

      expect(second.id).toBe(first.id);
      expect(second.strength).toBeCloseTo(0.7); // 0.5 + 0.2
    });

    it('does not dedup across agents', async () => {
      const first = await store.create({
        agentId: 'agent-1',
        type: 'decision',
        content: 'Same content',
        sourceSession: 'session-1',
      });

      const second = await store.create({
        agentId: 'agent-2',
        type: 'decision',
        content: 'Same content',
        sourceSession: 'session-1',
      });

      expect(second.id).not.toBe(first.id);
    });
  });

  describe('getById', () => {
    it('returns a memory by ID', async () => {
      const created = await store.create({
        agentId: 'agent-1',
        type: 'decision',
        content: 'Test memory',
        sourceSession: 'session-1',
      });

      const fetched = store.getById(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.id).toBe(created.id);
      expect(fetched!.content).toBe('Test memory');
    });

    it('returns null for nonexistent ID', () => {
      expect(store.getById('nonexistent')).toBeNull();
    });
  });

  describe('list', () => {
    it('lists memories for an agent', async () => {
      await store.create({ agentId: 'agent-1', type: 'decision', content: 'Memory 1', sourceSession: 's1' });
      await store.create({ agentId: 'agent-1', type: 'pattern', content: 'Memory 2', sourceSession: 's1' });
      await store.create({ agentId: 'agent-2', type: 'decision', content: 'Memory 3', sourceSession: 's1' });

      const list = store.list('agent-1');
      expect(list).toHaveLength(2);
      expect(list.every((m) => m.agentId === 'agent-1')).toBe(true);
    });

    it('respects limit and offset', async () => {
      for (let i = 0; i < 5; i++) {
        await store.create({ agentId: 'a1', type: 'decision', content: `Memory ${i}`, sourceSession: 's1' });
      }

      const page1 = store.list('a1', 2, 0);
      const page2 = store.list('a1', 2, 2);
      expect(page1).toHaveLength(2);
      expect(page2).toHaveLength(2);
      expect(page1[0]!.id).not.toBe(page2[0]!.id);
    });
  });

  describe('update', () => {
    it('updates content', async () => {
      const mem = await store.create({
        agentId: 'agent-1',
        type: 'decision',
        content: 'Original',
        sourceSession: 's1',
      });

      const updated = await store.update(mem.id, { content: 'Updated content' });
      expect(updated!.content).toBe('Updated content');
    });

    it('updates tags', async () => {
      const mem = await store.create({
        agentId: 'agent-1',
        type: 'decision',
        content: 'Tagged memory',
        sourceSession: 's1',
        tags: ['old-tag'],
      });

      const updated = await store.update(mem.id, { tags: ['new-tag', 'another'] });
      expect(updated!.tags.sort()).toEqual(['another', 'new-tag']);
    });

    it('returns null for nonexistent memory', async () => {
      const result = await store.update('nonexistent', { content: 'nope' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('soft-deletes a memory', async () => {
      const mem = await store.create({
        agentId: 'agent-1',
        type: 'decision',
        content: 'To be deleted',
        sourceSession: 's1',
      });

      const deleted = store.delete(mem.id);
      expect(deleted).toBe(true);

      const fetched = store.getById(mem.id);
      expect(fetched!.enabled).toBe(false);
    });

    it('returns false for already-deleted memory', async () => {
      const mem = await store.create({
        agentId: 'agent-1',
        type: 'decision',
        content: 'Delete me',
        sourceSession: 's1',
      });

      store.delete(mem.id);
      expect(store.delete(mem.id)).toBe(false);
    });
  });

  describe('hardDelete', () => {
    it('permanently removes a memory', async () => {
      const mem = await store.create({
        agentId: 'agent-1',
        type: 'decision',
        content: 'Gone forever',
        sourceSession: 's1',
      });

      store.hardDelete(mem.id);
      expect(store.getById(mem.id)).toBeNull();
    });
  });

  describe('stats', () => {
    it('returns correct statistics', async () => {
      await store.create({ agentId: 'a1', type: 'decision', content: 'D1', sourceSession: 's1' });
      await store.create({ agentId: 'a1', type: 'pattern', content: 'P1', sourceSession: 's1' });
      await store.create({ agentId: 'a2', type: 'preference', content: 'Pref1', sourceSession: 's1' });

      const s = store.stats();
      expect(s.totalMemories).toBe(3);
      expect(s.enabledMemories).toBe(3);
      expect(s.embeddedMemories).toBe(0);
      expect(s.byType.decision).toBe(1);
      expect(s.byType.pattern).toBe(1);
      expect(s.byType.preference).toBe(1);
      expect(s.byAgent['a1']).toBe(2);
      expect(s.byAgent['a2']).toBe(1);
    });
  });

  describe('recordRecall', () => {
    it('updates recall stats and boosts strength', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Recall me',
        sourceSession: 's1',
      });

      // Lower strength so boost is visible (capped at 1.0)
      db.prepare('UPDATE memories SET strength = 0.5 WHERE id = ?').run(mem.id);

      store.recordRecall(mem.id, 0.8);
      const updated = store.getById(mem.id)!;

      expect(updated.recallCount).toBe(1);
      expect(updated.relevanceScore).toBe(0.8);
      expect(updated.lastRecalledAt).toBeTruthy();
      expect(updated.strength).toBeCloseTo(0.55); // 0.5 + 0.05
    });
  });

  describe('consolidate', () => {
    it('archives weak memories', async () => {
      const weak = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Weak memory',
        sourceSession: 's1',
      });
      // Manually set low strength
      db.prepare('UPDATE memories SET strength = 0.01 WHERE id = ?').run(weak.id);

      await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Strong memory',
        sourceSession: 's1',
      });

      const result = store.consolidate('a1', 0.1);
      expect(result.archived).toBeGreaterThanOrEqual(1);
      expect(result.remaining).toBe(1);
    });
  });
});

// ── Search Tests (with embedding provider) ─────────────────────────

describe('MemoryStoreService with embeddings', () => {
  let db: Database.Database;
  let store: MemoryStoreService;

  beforeEach(() => {
    db = createTestDb();
    store = new MemoryStoreService(db, {
      embeddingProvider: createFakeEmbeddingProvider(),
      autoEmbed: true,
    });
  });

  afterEach(() => {
    db.close();
  });

  it('auto-embeds on create', async () => {
    const mem = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Use Fastify for the API',
      sourceSession: 's1',
    });

    expect(mem.hasEmbedding).toBe(true);
  });

  it('re-embeds on content update', async () => {
    const mem = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Original content',
      sourceSession: 's1',
    });

    const updated = await store.update(mem.id, { content: 'Updated content' });
    expect(updated!.hasEmbedding).toBe(true);
  });

  it('performs vector search', async () => {
    await store.create({ agentId: 'a1', type: 'decision', content: 'Use TypeScript strict mode for safety', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'pattern', content: 'Database uses SQLite with WAL mode', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'preference', content: 'Team prefers pnpm over npm', sourceSession: 's1' });

    const response = await store.search({
      query: 'TypeScript configuration',
      agentId: 'a1',
      topK: 2,
      threshold: 0,
    });

    expect(response.results.length).toBeGreaterThan(0);
    expect(response.results.length).toBeLessThanOrEqual(2);
    expect(response.searchTimeMs).toBeGreaterThanOrEqual(0);
    expect(response.totalSearched).toBe(3);

    // All results should have similarity scores
    for (const r of response.results) {
      expect(r.similarityScore).toBeGreaterThanOrEqual(0);
      expect(r.combinedScore).toBeGreaterThan(0);
    }
  });

  it('filters by memory type', async () => {
    await store.create({ agentId: 'a1', type: 'decision', content: 'A decision', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'pattern', content: 'A pattern', sourceSession: 's1' });

    const response = await store.search({
      query: 'something',
      agentId: 'a1',
      types: ['decision'],
      threshold: 0,
    });

    expect(response.results.every((r) => r.memory.type === 'decision')).toBe(true);
  });

  it('filters by tags', async () => {
    await store.create({ agentId: 'a1', type: 'decision', content: 'Tagged one', sourceSession: 's1', tags: ['arch'] });
    await store.create({ agentId: 'a1', type: 'decision', content: 'Tagged two', sourceSession: 's1', tags: ['testing'] });

    const response = await store.search({
      query: 'something',
      agentId: 'a1',
      tags: ['arch'],
      threshold: 0,
    });

    expect(response.results.every((r) => (r.memory as any).tags.includes('arch'))).toBe(true);
  });

  it('respects similarity threshold', async () => {
    await store.create({ agentId: 'a1', type: 'decision', content: 'Memory content', sourceSession: 's1' });

    const highThreshold = await store.search({
      query: 'something completely different',
      agentId: 'a1',
      threshold: 0.99,
    });

    // With a very high threshold, most results should be filtered out
    expect(highThreshold.results.length).toBeLessThanOrEqual(1);
  });

  it('batch-embeds memories via embedAll', async () => {
    // Create a store without auto-embed
    const noAutoStore = new MemoryStoreService(db, {
      embeddingProvider: createFakeEmbeddingProvider(),
      autoEmbed: false,
    });

    await noAutoStore.create({ agentId: 'a1', type: 'decision', content: 'No embed 1', sourceSession: 's1' });
    await noAutoStore.create({ agentId: 'a1', type: 'decision', content: 'No embed 2', sourceSession: 's1' });

    let stats = noAutoStore.stats();
    expect(stats.embeddedMemories).toBe(0);

    // Now switch to a store with the provider and backfill
    const withProvider = new MemoryStoreService(db, {
      embeddingProvider: createFakeEmbeddingProvider(),
      autoEmbed: true,
    });

    const count = await withProvider.embedAll();
    expect(count).toBe(2);

    stats = withProvider.stats();
    expect(stats.embeddedMemories).toBe(2);
  });
});
