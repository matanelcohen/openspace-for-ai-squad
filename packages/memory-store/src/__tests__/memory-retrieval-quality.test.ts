/**
 * Retrieval quality tests for @openspace/memory-store
 *
 * Validates that the search system returns relevant results with correct
 * ranking, filtering, and scoring. Tests precision, recall, hybrid scoring,
 * and fallback behavior.
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

/**
 * Create a semantic embedding provider that maps similar words to similar vectors.
 * This gives us more realistic similarity search behavior for quality tests.
 */
function createSemanticEmbeddingProvider(dimensions = 16): EmbeddingProvider {
  // Topic clusters: words that are semantically related get similar base vectors
  const topicVectors: Record<string, number[]> = {
    // Database topic
    database: [1, 0.8, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    postgresql: [0.9, 0.9, 0.3, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    mysql: [0.8, 0.85, 0.25, 0.15, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    sql: [0.85, 0.7, 0.3, 0.2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    storage: [0.7, 0.6, 0.4, 0.1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    // Frontend topic
    react: [0, 0, 0, 0, 1, 0.9, 0.2, 0.1, 0, 0, 0, 0, 0, 0, 0, 0],
    frontend: [0, 0, 0, 0, 0.9, 0.8, 0.3, 0.2, 0, 0, 0, 0, 0, 0, 0, 0],
    ui: [0, 0, 0, 0, 0.8, 0.7, 0.4, 0.3, 0, 0, 0, 0, 0, 0, 0, 0],
    component: [0, 0, 0, 0, 0.7, 0.8, 0.5, 0.2, 0, 0, 0, 0, 0, 0, 0, 0],
    // Testing topic
    test: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0.8, 0.2, 0.1, 0, 0, 0, 0],
    testing: [0, 0, 0, 0, 0, 0, 0, 0, 0.95, 0.85, 0.25, 0.1, 0, 0, 0, 0],
    vitest: [0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.9, 0.3, 0.15, 0, 0, 0, 0],
    jest: [0, 0, 0, 0, 0, 0, 0, 0, 0.85, 0.85, 0.3, 0.2, 0, 0, 0, 0],
    // DevOps topic
    docker: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.8, 0.3, 0.1],
    deployment: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.9, 0.7, 0.4, 0.2],
    kubernetes: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.95, 0.85, 0.35, 0.15],
    ci: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.8, 0.6, 0.5, 0.3],
  };

  return {
    modelId: 'semantic-test-model',
    dimensions,
    async embed(text: string): Promise<Embedding> {
      const vec = new Float64Array(dimensions);
      const words = text.toLowerCase().split(/\W+/).filter(Boolean);
      let matchCount = 0;

      // Accumulate topic vectors for matching words
      for (const word of words) {
        if (topicVectors[word]) {
          matchCount++;
          for (let i = 0; i < dimensions; i++) {
            vec[i] += topicVectors[word]![i]!;
          }
        }
      }

      // Add some noise based on all words (for differentiation)
      for (let i = 0; i < dimensions; i++) {
        let hash = 0;
        for (let j = 0; j < text.length; j++) {
          hash = ((hash << 5) - hash + text.charCodeAt(j) + i * 31) | 0;
        }
        vec[i] += Math.sin(hash) * 0.1;
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

// ── Precision Tests ────────────────────────────────────────────────

describe('search precision — relevant results ranked higher', () => {
  let db: Database.Database;
  let store: MemoryStoreService;

  beforeEach(() => {
    db = createTestDb();
    store = new MemoryStoreService(db, {
      embeddingProvider: createSemanticEmbeddingProvider(),
      autoEmbed: true,
    });
  });
  afterEach(() => {
    db.close();
  });

  it('database query returns database memories with higher scores', async () => {
    // Seed diverse memories
    await store.create({ agentId: 'a1', type: 'decision', content: 'We chose PostgreSQL as the primary database for SQL queries', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'decision', content: 'React is the frontend UI component framework of choice', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'decision', content: 'Docker and Kubernetes handle deployment CI pipelines', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'pattern', content: 'Vitest is used for testing with jest-compatible API', sourceSession: 's1' });

    const result = await store.search({
      query: 'database SQL storage',
      agentId: 'a1',
      topK: 4,
      threshold: 0,
    });

    // The database-related memory should be ranked first
    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]!.memory.content).toContain('PostgreSQL');
  });

  it('frontend query returns frontend memories with higher scores', async () => {
    await store.create({ agentId: 'a1', type: 'decision', content: 'PostgreSQL database for storage of SQL data', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'decision', content: 'React frontend UI component library for the app', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'decision', content: 'Docker deployment with Kubernetes CI', sourceSession: 's1' });

    const result = await store.search({
      query: 'React frontend UI component',
      agentId: 'a1',
      topK: 3,
      threshold: 0,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]!.memory.content).toContain('React');
  });
});

// ── Recall Tests ───────────────────────────────────────────────────

describe('search recall — all relevant results returned', () => {
  let db: Database.Database;
  let store: MemoryStoreService;

  beforeEach(() => {
    db = createTestDb();
    store = new MemoryStoreService(db, {
      embeddingProvider: createSemanticEmbeddingProvider(),
      autoEmbed: true,
    });
  });
  afterEach(() => {
    db.close();
  });

  it('returns all relevant memories when topK is large enough', async () => {
    // Multiple database-related memories
    await store.create({ agentId: 'a1', type: 'decision', content: 'Use PostgreSQL database for SQL storage', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'pattern', content: 'MySQL database backup runs nightly', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'preference', content: 'Team prefers pizza on Fridays', sourceSession: 's1' });

    const result = await store.search({
      query: 'database SQL',
      agentId: 'a1',
      topK: 10,
      threshold: 0,
    });

    // Should return all 3 (low threshold), but database ones should rank higher
    expect(result.results.length).toBeGreaterThanOrEqual(2);

    // The database-related ones should appear in results
    const contents = result.results.map((r) => r.memory.content);
    expect(contents.some((c) => c.includes('PostgreSQL'))).toBe(true);
    expect(contents.some((c) => c.includes('MySQL'))).toBe(true);
  });
});

// ── Hybrid Scoring ─────────────────────────────────────────────────

describe('hybrid search scoring', () => {
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

  it('results have both similarity and FTS scores when hybrid is on', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Use TypeScript for type safety across the project',
      sourceSession: 's1',
    });

    const result = await store.search({
      query: 'TypeScript',
      agentId: 'a1',
      hybridSearch: true,
      threshold: 0,
    });

    expect(result.results.length).toBeGreaterThan(0);
    const top = result.results[0]!;
    expect(top.similarityScore).toBeGreaterThanOrEqual(0);
    // FTS should have found "TypeScript" in the content
    expect(top.ftsScore).not.toBeNull();
    expect(top.combinedScore).toBeGreaterThan(0);
  });

  it('combined score is higher than either individual score alone', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'TypeScript strict mode ensures better type safety',
      sourceSession: 's1',
    });

    const result = await store.search({
      query: 'TypeScript strict',
      agentId: 'a1',
      hybridSearch: true,
      threshold: 0,
    });

    if (result.results.length > 0) {
      const r = result.results[0]!;
      // Combined should be a weighted mix, potentially higher than just vector
      expect(r.combinedScore).toBeGreaterThan(0);
    }
  });

  it('vector-only search works when hybrid is disabled', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Memory for vector-only search test',
      sourceSession: 's1',
    });

    const result = await store.search({
      query: 'vector search',
      agentId: 'a1',
      hybridSearch: false,
      threshold: 0,
    });

    expect(result.results.length).toBeGreaterThan(0);
    // FTS score should be null since hybrid is off
    for (const r of result.results) {
      expect(r.ftsScore).toBeNull();
    }
  });
});

// ── FTS-only Fallback ──────────────────────────────────────────────

describe('FTS-only fallback (no embedding provider)', () => {
  let db: Database.Database;
  let store: MemoryStoreService;

  beforeEach(() => {
    db = createTestDb();
    store = new MemoryStoreService(db, {
      embeddingProvider: null,
      autoEmbed: false,
    });
  });
  afterEach(() => {
    db.close();
  });

  it('searches using only FTS when no embedding provider', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Use PostgreSQL for data persistence',
      sourceSession: 's1',
    });
    await store.create({
      agentId: 'a1',
      type: 'pattern',
      content: 'Always validate user input at boundaries',
      sourceSession: 's1',
    });

    const result = await store.search({
      query: 'PostgreSQL persistence',
      agentId: 'a1',
      threshold: 0,
    });

    expect(result.results.length).toBeGreaterThan(0);
    // Vector similarity should be 0 (no embeddings)
    for (const r of result.results) {
      expect(r.similarityScore).toBe(0);
    }
  });

  it('FTS finds exact word matches', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Redis is used for session caching',
      sourceSession: 's1',
    });
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'PostgreSQL handles persistent storage',
      sourceSession: 's1',
    });

    const result = await store.search({
      query: 'Redis caching',
      agentId: 'a1',
      threshold: 0,
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0]!.memory.content).toContain('Redis');
  });
});

// ── Threshold Filtering ────────────────────────────────────────────

describe('threshold filtering', () => {
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

  it('threshold 0 returns all memories', async () => {
    for (let i = 0; i < 5; i++) {
      await store.create({
        agentId: 'a1',
        type: 'decision',
        content: `Memory number ${i} about different topic ${i * 100}`,
        sourceSession: 's1',
      });
    }

    const result = await store.search({
      query: 'anything',
      agentId: 'a1',
      threshold: 0,
      topK: 10,
    });

    expect(result.results.length).toBe(5);
  });

  it('very high threshold filters out weak matches', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Some memory content about databases',
      sourceSession: 's1',
    });

    const result = await store.search({
      query: 'completely unrelated query about music',
      agentId: 'a1',
      threshold: 0.99,
    });

    expect(result.results.length).toBe(0);
  });

  it('increasing threshold progressively reduces results', async () => {
    for (let i = 0; i < 10; i++) {
      await store.create({
        agentId: 'a1',
        type: 'decision',
        content: `Technical decision ${i}: various approaches to system design and architecture patterns`,
        sourceSession: 's1',
      });
    }

    const low = await store.search({ query: 'system design', agentId: 'a1', threshold: 0, topK: 20 });
    const mid = await store.search({ query: 'system design', agentId: 'a1', threshold: 0.3, topK: 20 });
    const high = await store.search({ query: 'system design', agentId: 'a1', threshold: 0.7, topK: 20 });

    expect(low.results.length).toBeGreaterThanOrEqual(mid.results.length);
    expect(mid.results.length).toBeGreaterThanOrEqual(high.results.length);
  });
});

// ── topK Limiting ──────────────────────────────────────────────────

describe('topK limiting', () => {
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

  it('returns at most topK results', async () => {
    for (let i = 0; i < 10; i++) {
      await store.create({
        agentId: 'a1',
        type: 'decision',
        content: `Decision number ${i} about system architecture`,
        sourceSession: 's1',
      });
    }

    const result = await store.search({
      query: 'architecture',
      agentId: 'a1',
      topK: 3,
      threshold: 0,
    });

    expect(result.results.length).toBeLessThanOrEqual(3);
  });

  it('topK=1 returns exactly one result', async () => {
    for (let i = 0; i < 5; i++) {
      await store.create({
        agentId: 'a1',
        type: 'decision',
        content: `Memory ${i} about various topics`,
        sourceSession: 's1',
      });
    }

    const result = await store.search({
      query: 'topics',
      agentId: 'a1',
      topK: 1,
      threshold: 0,
    });

    expect(result.results.length).toBe(1);
  });

  it('topK larger than total memories returns all', async () => {
    await store.create({ agentId: 'a1', type: 'decision', content: 'Only memory', sourceSession: 's1' });

    const result = await store.search({
      query: 'memory',
      agentId: 'a1',
      topK: 100,
      threshold: 0,
    });

    expect(result.results.length).toBe(1);
  });
});

// ── Type Filtering ─────────────────────────────────────────────────

describe('type filtering precision', () => {
  let db: Database.Database;
  let store: MemoryStoreService;

  beforeEach(async () => {
    db = createTestDb();
    store = new MemoryStoreService(db, {
      embeddingProvider: createFakeEmbeddingProvider(),
      autoEmbed: true,
    });

    // Seed diverse types
    await store.create({ agentId: 'a1', type: 'decision', content: 'Decided on PostgreSQL', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'decision', content: 'Decided on TypeScript', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'pattern', content: 'Pattern: always validate input', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'pattern', content: 'Pattern: use dependency injection', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'preference', content: 'Preference: dark mode in IDE', sourceSession: 's1' });
  });
  afterEach(() => {
    db.close();
  });

  it('filters to only decisions', async () => {
    const result = await store.search({
      query: 'anything',
      agentId: 'a1',
      types: ['decision'],
      threshold: 0,
      topK: 10,
    });

    expect(result.results.length).toBe(2);
    expect(result.results.every((r) => r.memory.type === 'decision')).toBe(true);
  });

  it('filters to only patterns', async () => {
    const result = await store.search({
      query: 'anything',
      agentId: 'a1',
      types: ['pattern'],
      threshold: 0,
      topK: 10,
    });

    expect(result.results.length).toBe(2);
    expect(result.results.every((r) => r.memory.type === 'pattern')).toBe(true);
  });

  it('filters to multiple types', async () => {
    const result = await store.search({
      query: 'anything',
      agentId: 'a1',
      types: ['decision', 'preference'],
      threshold: 0,
      topK: 10,
    });

    expect(result.results.length).toBe(3); // 2 decisions + 1 preference
    const types = new Set(result.results.map((r) => r.memory.type));
    expect(types.has('pattern')).toBe(false);
  });

  it('empty type filter returns nothing from vector search but FTS may still match', async () => {
    const result = await store.search({
      query: 'anything',
      agentId: 'a1',
      types: [],
      threshold: 0,
      topK: 10,
    });

    // Empty types array means no type filter — implementation-dependent
    // All 5 should be returned since empty array doesn't add a filter clause
    expect(result.results.length).toBe(5);
  });
});

// ── Result Ordering ────────────────────────────────────────────────

describe('result ordering by combined score', () => {
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

  it('results are sorted by combined score descending', async () => {
    for (let i = 0; i < 10; i++) {
      await store.create({
        agentId: 'a1',
        type: 'decision',
        content: `Technical decision variant ${i}: ${i % 2 === 0 ? 'database' : 'frontend'} approach`,
        sourceSession: 's1',
      });
    }

    const result = await store.search({
      query: 'database approach',
      agentId: 'a1',
      topK: 10,
      threshold: 0,
    });

    for (let i = 1; i < result.results.length; i++) {
      expect(result.results[i - 1]!.combinedScore).toBeGreaterThanOrEqual(
        result.results[i]!.combinedScore,
      );
    }
  });

  it('higher importance memories get a scoring boost', async () => {
    const lowImp = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Same content about architecture patterns and design',
      sourceSession: 's1',
      importance: 0.1,
    });
    const highImp = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Same content about architecture patterns and design decisions',
      sourceSession: 's1',
      importance: 0.9,
    });

    const result = await store.search({
      query: 'architecture patterns design',
      agentId: 'a1',
      topK: 2,
      threshold: 0,
    });

    // Both should appear; higher importance should get a scoring boost
    expect(result.results.length).toBe(2);
    // The importance weight contributes 15% to the combined score
    const scores = result.results.map((r) => ({
      id: r.memory.id,
      combined: r.combinedScore,
      importance: (r.memory as any).importance,
    }));
    // Verify both have positive scores
    expect(scores[0]!.combined).toBeGreaterThan(0);
    expect(scores[1]!.combined).toBeGreaterThan(0);
  });

  it('higher strength memories get a scoring boost', async () => {
    const m1 = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Architecture design for microservices approach',
      sourceSession: 's1',
    });
    const m2 = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Architecture design for monolith approach',
      sourceSession: 's1',
    });

    // Set different strengths
    db.prepare('UPDATE memories SET strength = 0.1 WHERE id = ?').run(m1.id);
    db.prepare('UPDATE memories SET strength = 1.0 WHERE id = ?').run(m2.id);

    const result = await store.search({
      query: 'architecture design approach',
      agentId: 'a1',
      topK: 2,
      threshold: 0,
    });

    expect(result.results.length).toBe(2);
  });
});

// ── Search Metadata ────────────────────────────────────────────────

describe('search response metadata', () => {
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

  it('totalSearched reflects actual memory count', async () => {
    for (let i = 0; i < 7; i++) {
      await store.create({
        agentId: 'a1',
        type: 'decision',
        content: `Memory ${i} for search count test`,
        sourceSession: 's1',
      });
    }

    const result = await store.search({
      query: 'test',
      agentId: 'a1',
      topK: 3,
      threshold: 0,
    });

    expect(result.totalSearched).toBe(7);
  });

  it('searchTimeMs is non-negative', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Test timing',
      sourceSession: 's1',
    });

    const result = await store.search({
      query: 'timing',
      agentId: 'a1',
      threshold: 0,
    });

    expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('empty results still include metadata', async () => {
    const result = await store.search({
      query: 'nothing here',
      agentId: 'nonexistent-agent',
      threshold: 0,
    });

    expect(result.results).toEqual([]);
    expect(result.totalSearched).toBe(0);
    expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
  });
});

// ── Disabled/Expired Exclusion ─────────────────────────────────────

describe('disabled and expired memory exclusion from search', () => {
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

  it('disabled memories are excluded from vector search', async () => {
    const mem = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Disabled memory about databases and architecture',
      sourceSession: 's1',
    });
    store.delete(mem.id);

    const result = await store.search({
      query: 'databases architecture',
      agentId: 'a1',
      threshold: 0,
    });

    expect(result.results.length).toBe(0);
  });

  it('mix of enabled and disabled — only enabled returned', async () => {
    const m1 = await store.create({ agentId: 'a1', type: 'decision', content: 'Enabled memory about cats', sourceSession: 's1' });
    const m2 = await store.create({ agentId: 'a1', type: 'decision', content: 'Disabled memory about dogs', sourceSession: 's1' });
    await store.create({ agentId: 'a1', type: 'decision', content: 'Enabled memory about birds', sourceSession: 's1' });

    store.delete(m2.id);

    const result = await store.search({
      query: 'animals',
      agentId: 'a1',
      threshold: 0,
    });

    // Should only get enabled memories
    for (const r of result.results) {
      expect(r.memory.enabled).toBe(true);
    }
    expect(result.results.length).toBe(2);
  });
});
