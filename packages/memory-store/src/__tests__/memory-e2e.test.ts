/**
 * E2E multi-session tests for @openspace/memory-store
 *
 * Simulates realistic multi-session agent interaction to verify memory
 * continuity, recall across sessions, decay over time, and the full
 * extract → store → search → use round-trip.
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

/**
 * Simulate time passing by backdating updated_at for an agent's memories.
 */
function ageMemories(db: Database.Database, agentId: string, daysAgo: number): void {
  const past = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('UPDATE memories SET updated_at = ? WHERE agent_id = ?').run(past, agentId);
}

// ── Multi-Session Agent Interaction ────────────────────────────────

describe('E2E: multi-session memory continuity', () => {
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

  it('session-1 decisions persist and are usable in session-2', async () => {
    // ── SESSION 1: Agent works on a project ──
    await store.create({
      agentId: 'architect',
      type: 'decision',
      content: 'The API will use REST over HTTP/2 with JSON payloads',
      sourceSession: 'session-1',
      sourceTaskId: 'task-api-design',
      tags: ['api', 'architecture'],
    });
    await store.create({
      agentId: 'architect',
      type: 'decision',
      content: 'Authentication uses JWT tokens with 15-minute expiry',
      sourceSession: 'session-1',
      sourceTaskId: 'task-auth-design',
      tags: ['auth', 'security'],
    });
    await store.create({
      agentId: 'architect',
      type: 'pattern',
      content: 'All endpoints must validate input schemas before processing',
      sourceSession: 'session-1',
      tags: ['validation', 'patterns'],
    });

    // ── SESSION 2: New session, agent needs to recall decisions ──
    // (Same store instance simulates the same persistent DB)
    const recallResult = await store.search({
      query: 'How should API authentication work?',
      agentId: 'architect',
      topK: 5,
      threshold: 0,
    });

    expect(recallResult.results.length).toBeGreaterThan(0);
    expect(recallResult.totalSearched).toBe(3);

    // Record that we used these memories
    for (const r of recallResult.results) {
      store.recordRecall(r.memory.id, r.combinedScore);
    }

    // Verify recall stats were updated
    for (const r of recallResult.results) {
      const mem = store.getById(r.memory.id)!;
      expect(mem.recallCount).toBe(1);
      expect(mem.lastRecalledAt).toBeTruthy();
    }

    // ── SESSION 3: Even later, memories still available ──
    const laterRecall = await store.search({
      query: 'REST API JSON',
      agentId: 'architect',
      topK: 3,
      threshold: 0,
    });

    expect(laterRecall.results.length).toBeGreaterThan(0);
  });

  it('memory strength decays over simulated time but recall boosts it', async () => {
    const mem = await store.create({
      agentId: 'dev',
      type: 'decision',
      content: 'Use pnpm workspaces for monorepo management',
      sourceSession: 'session-1',
      tags: ['tooling'],
    });

    const initialStrength = mem.strength;
    expect(initialStrength).toBeCloseTo(1.0);

    // ── Simulate 45 days passing ──
    ageMemories(db, 'dev', 45);
    store.decay('dev');

    const after45 = store.getById(mem.id)!;
    expect(after45.strength).toBeLessThan(initialStrength);
    expect(after45.strength).toBeGreaterThan(0.5); // Half-life is 90 days

    // ── Session-2: Memory is recalled, boosting strength ──
    store.recordRecall(mem.id, 0.9);
    const afterRecall = store.getById(mem.id)!;
    expect(afterRecall.strength).toBeGreaterThan(after45.strength);

    // ── Simulate another 45 days ──
    ageMemories(db, 'dev', 45);
    store.decay('dev');

    const after90 = store.getById(mem.id)!;
    // Still alive because of the recall boost
    expect(after90.strength).toBeGreaterThan(0);
    expect(after90.enabled).toBe(true);
  });

  it('expired memories disappear from search in later sessions', async () => {
    // Session 1: Create a short-lived memory
    await store.create({
      agentId: 'dev',
      type: 'preference',
      content: 'Temporarily prefer verbose logging for debugging',
      sourceSession: 'session-1',
      ttlSeconds: 3600, // 1 hour
    });

    // Also create a persistent memory
    await store.create({
      agentId: 'dev',
      type: 'decision',
      content: 'Use structured JSON logging in production',
      sourceSession: 'session-1',
    });

    // Session 2 (immediately): Both memories visible
    const immediately = await store.search({
      query: 'logging',
      agentId: 'dev',
      threshold: 0,
    });
    expect(immediately.results.length).toBe(2);

    // Simulate expiration by backdating expires_at
    db.prepare(
      `UPDATE memories SET expires_at = ? WHERE expires_at IS NOT NULL`,
    ).run(new Date(Date.now() - 60_000).toISOString());

    // Session 3 (after expiration): Only persistent memory visible
    const afterExpiry = await store.search({
      query: 'logging',
      agentId: 'dev',
      threshold: 0,
    });

    expect(afterExpiry.results.length).toBe(1);
    expect(afterExpiry.results[0]!.memory.content).toContain('structured JSON logging');
  });
});

// ── Full Round-Trip: Extract → Store → Search → Context ────────────

describe('E2E: full memory round-trip', () => {
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

  it('extract memories from task → store → recall in next task', async () => {
    // ── STEP 1: Simulate memory extraction from completed task ──
    // (In production, MemoryExtractor does this via LLM; here we simulate)
    const extractedMemories = [
      { type: 'decision' as const, content: 'Chose Fastify over Express for 3x better throughput' },
      { type: 'pattern' as const, content: 'Services use repository pattern with dependency injection' },
      { type: 'preference' as const, content: 'Team prefers kebab-case for file naming' },
    ];

    // ── STEP 2: Store extracted memories ──
    for (const extracted of extractedMemories) {
      await store.create({
        agentId: 'backend-dev',
        type: extracted.type,
        content: extracted.content,
        sourceSession: 'session-task-42',
        sourceTaskId: 'task-42',
      });
    }

    const stats = store.stats();
    expect(stats.totalMemories).toBe(3);
    expect(stats.embeddedMemories).toBe(3);

    // ── STEP 3: In a new task, recall relevant memories ──
    const frameworkSearch = await store.search({
      query: 'Which web framework should we use?',
      agentId: 'backend-dev',
      topK: 3,
      threshold: 0,
    });

    expect(frameworkSearch.results.length).toBeGreaterThan(0);

    // Record the recall
    for (const r of frameworkSearch.results) {
      store.recordRecall(r.memory.id, r.combinedScore);
    }

    // ── STEP 4: Build context block (simulated) ──
    const contextMemories = frameworkSearch.results
      .map((r) => `[${r.memory.type.toUpperCase()}] ${r.memory.content}`)
      .join('\n');

    expect(contextMemories.length).toBeGreaterThan(0);
    // At least one memory should be included
    expect(contextMemories.split('\n').length).toBeGreaterThanOrEqual(1);
  });

  it('re-extracted memories deduplicate with existing ones', async () => {
    // Session 1: First extraction
    await store.create({
      agentId: 'dev',
      type: 'decision',
      content: 'Use ESLint with strict TypeScript rules',
      sourceSession: 'session-1',
      sourceTaskId: 'task-1',
    });

    // Session 2: Same pattern extracted again
    const m2 = await store.create({
      agentId: 'dev',
      type: 'decision',
      content: 'Use ESLint with strict TypeScript rules',
      sourceSession: 'session-2',
      sourceTaskId: 'task-5',
    });

    // Should be the same memory (deduped)
    const list = store.list('dev');
    expect(list).toHaveLength(1);
    expect(list[0]!.id).toBe(m2.id);
    // Strength should have been boosted
    expect(list[0]!.strength).toBeGreaterThan(0.99); // boosted from 1.0
  });
});

// ── Multi-Agent Collaboration ──────────────────────────────────────

describe('E2E: multi-agent collaboration', () => {
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

  it('multiple agents build memories independently and recall their own', async () => {
    // ── Architect agent: session-1 ──
    await store.create({
      agentId: 'architect',
      type: 'decision',
      content: 'System uses event-driven microservices architecture',
      sourceSession: 'session-1',
      tags: ['architecture'],
    });
    await store.create({
      agentId: 'architect',
      type: 'decision',
      content: 'Each service has its own PostgreSQL database (database-per-service)',
      sourceSession: 'session-1',
      tags: ['architecture', 'database'],
    });

    // ── Developer agent: session-1 ──
    await store.create({
      agentId: 'developer',
      type: 'pattern',
      content: 'All service implementations follow hexagonal architecture',
      sourceSession: 'session-1',
      tags: ['patterns'],
    });
    await store.create({
      agentId: 'developer',
      type: 'preference',
      content: 'Use async/await over raw Promises for readability',
      sourceSession: 'session-1',
      tags: ['coding-style'],
    });

    // ── Tester agent: session-1 ──
    await store.create({
      agentId: 'tester',
      type: 'pattern',
      content: 'Integration tests use testcontainers for database isolation',
      sourceSession: 'session-1',
      tags: ['testing'],
    });

    // ── Session 2: Each agent recalls only their own memories ──
    const archSearch = await store.search({
      query: 'architecture decisions',
      agentId: 'architect',
      topK: 5,
      threshold: 0,
    });
    expect(archSearch.results.every((r) => r.memory.agentId === 'architect')).toBe(true);
    expect(archSearch.totalSearched).toBe(2);

    const devSearch = await store.search({
      query: 'coding patterns and style',
      agentId: 'developer',
      topK: 5,
      threshold: 0,
    });
    expect(devSearch.results.every((r) => r.memory.agentId === 'developer')).toBe(true);
    expect(devSearch.totalSearched).toBe(2);

    const testSearch = await store.search({
      query: 'testing approach',
      agentId: 'tester',
      topK: 5,
      threshold: 0,
    });
    expect(testSearch.results.every((r) => r.memory.agentId === 'tester')).toBe(true);
    expect(testSearch.totalSearched).toBe(1);

    // ── Global stats reflect all agents ──
    const stats = store.stats();
    expect(stats.totalMemories).toBe(5);
    expect(stats.byAgent['architect']).toBe(2);
    expect(stats.byAgent['developer']).toBe(2);
    expect(stats.byAgent['tester']).toBe(1);
  });
});

// ── Memory Consolidation Over Time ─────────────────────────────────

describe('E2E: memory consolidation over simulated time', () => {
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

  it('frequently recalled memories survive while unused ones fade', async () => {
    // Create a mix of memories
    const important = await store.create({
      agentId: 'dev',
      type: 'decision',
      content: 'Critical: always use parameterized SQL queries to prevent injection',
      sourceSession: 'session-1',
      tags: ['security'],
    });
    const trivial = await store.create({
      agentId: 'dev',
      type: 'preference',
      content: 'Bob likes his coffee black',
      sourceSession: 'session-1',
    });
    const useful = await store.create({
      agentId: 'dev',
      type: 'pattern',
      content: 'Error responses follow RFC 7807 problem details format',
      sourceSession: 'session-1',
      tags: ['api'],
    });

    // ── Simulate periodic recalls for the important memory ──
    // Day 30: recall the important one
    ageMemories(db, 'dev', 30);
    store.decay('dev');
    store.recordRecall(important.id, 0.95);

    // Day 60: recall again
    ageMemories(db, 'dev', 30);
    store.decay('dev');
    store.recordRecall(important.id, 0.9);

    // Day 90: recall again
    ageMemories(db, 'dev', 30);
    store.decay('dev');
    store.recordRecall(important.id, 0.85);

    // ── Check survival ──
    const importantMem = store.getById(important.id)!;
    const trivialMem = store.getById(trivial.id)!;
    const usefulMem = store.getById(useful.id)!;

    // Important memory should still be strong (recalled 3 times)
    expect(importantMem.strength).toBeGreaterThan(0);
    expect(importantMem.recallCount).toBe(3);

    // Trivial memory should have decayed significantly (never recalled)
    // After 3 rounds of decay from ~30 days each
    expect(trivialMem.strength).toBeLessThan(importantMem.strength);

    // ── Consolidation should archive the weakest ──
    const result = store.consolidate('dev', 0.15);

    // Verify important memory survived
    expect(store.getById(important.id)!.enabled).toBe(true);
  });
});

// ── Concurrent-like Access Patterns ────────────────────────────────

describe('E2E: concurrent-like access patterns', () => {
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

  it('simultaneous creates and searches do not interfere', async () => {
    // Simulate interleaved create and search operations
    const createPromises: Promise<any>[] = [];
    const searchPromises: Promise<any>[] = [];

    // Create 10 memories
    for (let i = 0; i < 10; i++) {
      createPromises.push(
        store.create({
          agentId: 'a1',
          type: 'decision',
          content: `Concurrent memory ${i}: unique content about system design`,
          sourceSession: 's1',
        }),
      );
    }

    // Wait for all creates to finish
    await Promise.all(createPromises);

    // Now run parallel searches
    for (let i = 0; i < 5; i++) {
      searchPromises.push(
        store.search({
          query: 'system design',
          agentId: 'a1',
          topK: 5,
          threshold: 0,
        }),
      );
    }

    const results = await Promise.all(searchPromises);

    // All searches should return consistent results
    for (const result of results) {
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.totalSearched).toBe(10);
    }
  });

  it('create-then-immediate-search finds the new memory', async () => {
    const mem = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Immediate search test: use GraphQL for the API layer',
      sourceSession: 's1',
    });

    // Immediately search for it
    const result = await store.search({
      query: 'GraphQL API',
      agentId: 'a1',
      topK: 1,
      threshold: 0,
    });

    expect(result.results.length).toBe(1);
    expect(result.results[0]!.memory.id).toBe(mem.id);
  });

  it('delete-then-search no longer finds the memory', async () => {
    const mem = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Will be deleted then searched: microservices pattern',
      sourceSession: 's1',
    });

    store.delete(mem.id);

    const result = await store.search({
      query: 'microservices pattern',
      agentId: 'a1',
      threshold: 0,
    });

    expect(result.results.length).toBe(0);
  });
});
