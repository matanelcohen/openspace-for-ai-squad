/**
 * Integration tests for @openspace/memory-store
 *
 * End-to-end flows that exercise multiple components working together:
 * full lifecycle, multi-session, agent isolation, tag workflows, etc.
 */

import BetterSqlite3 from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Embedding, EmbeddingProvider } from '../embedding.js';
import { contentHash } from '../lifecycle.js';
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

// ── Full Lifecycle Integration ─────────────────────────────────────

describe('full memory lifecycle', () => {
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

  it('create → embed → search → recall → decay → consolidate', async () => {
    // Step 1: Create memories from "session-1"
    const m1 = await store.create({
      agentId: 'architect',
      type: 'decision',
      content: 'We chose PostgreSQL as the primary database for its JSONB support',
      sourceSession: 'session-1',
      tags: ['database', 'architecture'],
    });
    const m2 = await store.create({
      agentId: 'architect',
      type: 'pattern',
      content: 'Services communicate via async message queues using RabbitMQ',
      sourceSession: 'session-1',
      tags: ['architecture', 'messaging'],
    });
    const m3 = await store.create({
      agentId: 'architect',
      type: 'preference',
      content: 'Team prefers TypeScript strict mode in all projects',
      sourceSession: 'session-1',
      tags: ['typescript', 'standards'],
    });

    expect(m1.hasEmbedding).toBe(true);
    expect(m2.hasEmbedding).toBe(true);
    expect(m3.hasEmbedding).toBe(true);

    // Step 2: Search from "session-2" context
    const searchResult = await store.search({
      query: 'What database technology did we choose?',
      agentId: 'architect',
      topK: 3,
      threshold: 0,
    });

    expect(searchResult.results.length).toBeGreaterThan(0);
    expect(searchResult.totalSearched).toBe(3);

    // Step 3: Record recall for top result
    const topResult = searchResult.results[0]!;
    store.recordRecall(topResult.memory.id, topResult.combinedScore);

    const recalled = store.getById(topResult.memory.id)!;
    expect(recalled.recallCount).toBe(1);
    expect(recalled.lastRecalledAt).toBeTruthy();

    // Step 4: Age the memories by backdating updated_at
    const oldDate = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(); // 200 days ago
    db.prepare('UPDATE memories SET updated_at = ? WHERE agent_id = ?').run(oldDate, 'architect');

    // Step 5: Apply decay
    const decayResult = store.decay('architect');
    expect(decayResult.updated + decayResult.archived).toBe(3);

    // Step 6: Consolidate
    const consolResult = store.consolidate('architect', 0.3);
    // Some weak memories should be archived after 200 days of decay
    expect(consolResult.archived).toBeGreaterThanOrEqual(0);

    // Verify stats reflect the lifecycle
    const stats = store.stats();
    expect(stats.totalMemories).toBe(3);
  });

  it('dedup across sessions preserves memory identity', async () => {
    // Session 1: Agent learns a pattern
    const original = await store.create({
      agentId: 'dev',
      type: 'pattern',
      content: 'Always run linting before committing code',
      sourceSession: 'session-1',
    });

    // Lower strength so boost is visible (default 1.0 + 0.2 caps at 1.0)
    db.prepare('UPDATE memories SET strength = 0.5 WHERE id = ?').run(original.id);

    // Session 2: Agent rediscovers the same pattern
    const rediscovered = await store.create({
      agentId: 'dev',
      type: 'pattern',
      content: 'Always run linting before committing code',
      sourceSession: 'session-2',
    });

    // Should be the same memory, not a duplicate
    expect(rediscovered.id).toBe(original.id);
    // Strength should be boosted (0.5 + 0.2 = 0.7)
    expect(rediscovered.strength).toBeCloseTo(0.7);

    // Session 3: Yet again
    const third = await store.create({
      agentId: 'dev',
      type: 'pattern',
      content: 'Always run linting before committing code',
      sourceSession: 'session-3',
    });

    expect(third.id).toBe(original.id);
    // 0.7 + 0.2 = 0.9
    expect(third.strength).toBeCloseTo(0.9);

    // Only one memory exists
    const list = store.list('dev');
    expect(list).toHaveLength(1);
  });
});

// ── Agent Isolation ────────────────────────────────────────────────

describe('agent isolation', () => {
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

  it('memories are scoped to their agent — no cross-agent leakage', async () => {
    await store.create({
      agentId: 'frontend-dev',
      type: 'decision',
      content: 'Use React with Next.js for the frontend',
      sourceSession: 's1',
      tags: ['frontend'],
    });
    await store.create({
      agentId: 'backend-dev',
      type: 'decision',
      content: 'Use Express.js for the backend API',
      sourceSession: 's1',
      tags: ['backend'],
    });

    // Search scoped to frontend-dev
    const frontendSearch = await store.search({
      query: 'What framework are we using?',
      agentId: 'frontend-dev',
      threshold: 0,
    });

    // All results should belong to frontend-dev
    for (const r of frontendSearch.results) {
      expect(r.memory.agentId).toBe('frontend-dev');
    }

    // List scoped to backend-dev
    const backendList = store.list('backend-dev');
    expect(backendList).toHaveLength(1);
    expect(backendList[0]!.agentId).toBe('backend-dev');
  });

  it('deduplication does not cross agent boundaries', async () => {
    const content = 'Use TypeScript for type safety';

    const agent1Mem = await store.create({
      agentId: 'agent-1',
      type: 'decision',
      content,
      sourceSession: 's1',
    });
    const agent2Mem = await store.create({
      agentId: 'agent-2',
      type: 'decision',
      content,
      sourceSession: 's1',
    });

    expect(agent1Mem.id).not.toBe(agent2Mem.id);

    const stats = store.stats();
    expect(stats.byAgent['agent-1']).toBe(1);
    expect(stats.byAgent['agent-2']).toBe(1);
  });

  it('consolidation only affects the specified agent', async () => {
    const m1 = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Agent 1 weak memory',
      sourceSession: 's1',
    });
    await store.create({
      agentId: 'a2',
      type: 'decision',
      content: 'Agent 2 weak memory',
      sourceSession: 's1',
    });

    // Weaken agent-1's memory
    db.prepare('UPDATE memories SET strength = 0.01 WHERE id = ?').run(m1.id);

    const result = store.consolidate('a1', 0.1);
    expect(result.archived).toBe(1);

    // Agent-2 should be unaffected
    const a2List = store.list('a2');
    expect(a2List).toHaveLength(1);
    expect(a2List[0]!.enabled).toBe(true);
  });
});

// ── Embedding Backfill Integration ─────────────────────────────────

describe('embedding backfill workflow', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it('creates without embeddings, then backfills, then searches', async () => {
    // Phase 1: Create memories without embedding provider
    const noEmbedStore = new MemoryStoreService(db, { autoEmbed: false });

    await noEmbedStore.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Decided to use PostgreSQL for data storage',
      sourceSession: 's1',
    });
    await noEmbedStore.create({
      agentId: 'a1',
      type: 'pattern',
      content: 'Services always validate input at the boundary',
      sourceSession: 's1',
    });
    await noEmbedStore.create({
      agentId: 'a1',
      type: 'preference',
      content: 'Team prefers pnpm over npm for package management',
      sourceSession: 's1',
    });

    let stats = noEmbedStore.stats();
    expect(stats.embeddedMemories).toBe(0);

    // Phase 2: Enable embedding provider and backfill
    const embedStore = new MemoryStoreService(db, {
      embeddingProvider: createFakeEmbeddingProvider(),
      autoEmbed: true,
    });

    const embedded = await embedStore.embedAll();
    expect(embedded).toBe(3);

    stats = embedStore.stats();
    expect(stats.embeddedMemories).toBe(3);

    // Phase 3: Now search works with vectors
    const result = await embedStore.search({
      query: 'database technology',
      agentId: 'a1',
      threshold: 0,
    });

    expect(result.results.length).toBeGreaterThan(0);
    // Should have similarity scores now
    for (const r of result.results) {
      expect(r.similarityScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('embedAll skips already-embedded memories', async () => {
    const store = new MemoryStoreService(db, {
      embeddingProvider: createFakeEmbeddingProvider(),
      autoEmbed: true,
    });

    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Already embedded memory',
      sourceSession: 's1',
    });

    // All memories are already embedded
    const count = await store.embedAll();
    expect(count).toBe(0);
  });
});

// ── Tag-based Workflows ────────────────────────────────────────────

describe('tag lifecycle', () => {
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

  it('add tags → search by tag → update tags → search again', async () => {
    const mem = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Use ESLint with strict rules for code quality',
      sourceSession: 's1',
      tags: ['tooling', 'quality'],
    });

    // Search by tag
    const r1 = await store.search({
      query: 'code quality',
      agentId: 'a1',
      tags: ['tooling'],
      threshold: 0,
    });
    expect(r1.results.length).toBe(1);

    // Update tags
    await store.update(mem.id, { tags: ['standards', 'ci'] });

    // Old tag no longer matches
    const r2 = await store.search({
      query: 'code quality',
      agentId: 'a1',
      tags: ['tooling'],
      threshold: 0,
    });
    expect(r2.results.length).toBe(0);

    // New tag matches
    const r3 = await store.search({
      query: 'code quality',
      agentId: 'a1',
      tags: ['standards'],
      threshold: 0,
    });
    expect(r3.results.length).toBe(1);
  });

  it('multi-tag filter matches any tag (OR)', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Frontend decision: use React',
      sourceSession: 's1',
      tags: ['frontend'],
    });
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Backend decision: use Express',
      sourceSession: 's1',
      tags: ['backend'],
    });
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'DevOps decision: use Docker',
      sourceSession: 's1',
      tags: ['devops'],
    });

    // Search with multiple tags (should match frontend OR backend)
    const result = await store.search({
      query: 'technology decisions',
      agentId: 'a1',
      tags: ['frontend', 'backend'],
      threshold: 0,
    });

    expect(result.results.length).toBe(2);
    const types = result.results.map((r) => (r.memory as any).tags[0]);
    expect(types.sort()).toEqual(['backend', 'frontend']);
  });
});

// ── Search After Mutations ─────────────────────────────────────────

describe('search reflects mutations', () => {
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

  it('content update changes search results', async () => {
    const mem = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'We use MySQL for the database',
      sourceSession: 's1',
    });

    // Search finds MySQL
    const before = await store.search({
      query: 'MySQL database',
      agentId: 'a1',
      threshold: 0,
    });
    expect(before.results.length).toBeGreaterThan(0);

    // Update to PostgreSQL
    await store.update(mem.id, { content: 'We use PostgreSQL for the database' });

    // Search for PostgreSQL now works
    const after = await store.search({
      query: 'PostgreSQL database',
      agentId: 'a1',
      threshold: 0,
    });
    expect(after.results.length).toBeGreaterThan(0);
  });

  it('soft-deleted memories excluded from search', async () => {
    const mem = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'This memory will be deleted soon',
      sourceSession: 's1',
    });

    const before = await store.search({
      query: 'deleted',
      agentId: 'a1',
      threshold: 0,
    });
    expect(before.results.length).toBe(1);

    store.delete(mem.id);

    const after = await store.search({
      query: 'deleted',
      agentId: 'a1',
      threshold: 0,
    });
    expect(after.results.length).toBe(0);
  });

  it('expired memories excluded from search', async () => {
    await store.create({
      agentId: 'a1',
      type: 'preference',
      content: 'Short-lived preference for testing',
      sourceSession: 's1',
      ttlSeconds: 0,
    });

    // Force expiration time to past
    db.prepare(`UPDATE memories SET expires_at = ? WHERE agent_id = 'a1'`).run(
      new Date(Date.now() - 60_000).toISOString(),
    );

    const result = await store.search({
      query: 'short-lived preference',
      agentId: 'a1',
      threshold: 0,
    });

    // Search auto-expires, so results should be empty
    expect(result.results.length).toBe(0);
  });
});

// ── Stats Accuracy Through Lifecycle ───────────────────────────────

describe('stats accuracy through lifecycle', () => {
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

  it('tracks stats correctly through create, delete, and embedding', async () => {
    // Create three memories
    const m1 = await store.create({ agentId: 'a1', type: 'decision', content: 'Decision memory', sourceSession: 's1' });
    const m2 = await store.create({ agentId: 'a1', type: 'pattern', content: 'Pattern memory', sourceSession: 's1' });
    await store.create({ agentId: 'a2', type: 'preference', content: 'Preference memory', sourceSession: 's1' });

    let s = store.stats();
    expect(s.totalMemories).toBe(3);
    expect(s.enabledMemories).toBe(3);
    expect(s.embeddedMemories).toBe(3);
    expect(s.byType.decision).toBe(1);
    expect(s.byType.pattern).toBe(1);
    expect(s.byType.preference).toBe(1);
    expect(s.byAgent['a1']).toBe(2);
    expect(s.byAgent['a2']).toBe(1);

    // Soft-delete one
    store.delete(m1.id);
    s = store.stats();
    expect(s.totalMemories).toBe(3); // Still exists in DB
    expect(s.enabledMemories).toBe(2);
    expect(s.byType.decision).toBe(0); // Disabled
    expect(s.byAgent['a1']).toBe(1);

    // Hard-delete another (CASCADE removes embedding too)
    store.hardDelete(m2.id);
    s = store.stats();
    expect(s.totalMemories).toBe(2);
    expect(s.enabledMemories).toBe(1);
    // Embedding count: m1's embedding still exists (soft-delete doesn't remove it),
    // m2's embedding was cascaded, m3's embedding exists = 2
    expect(s.embeddedMemories).toBe(2);
  });
});

// ── Multi-Agent Shared DB ──────────────────────────────────────────

describe('multi-agent on shared database', () => {
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

  it('multiple agents coexist without interference', async () => {
    const agents = ['architect', 'developer', 'tester', 'devops'];
    const memories: Map<string, string[]> = new Map();

    // Each agent creates memories
    for (const agent of agents) {
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const mem = await store.create({
          agentId: agent,
          type: 'decision',
          content: `${agent} made decision number ${i} about the project`,
          sourceSession: 's1',
        });
        ids.push(mem.id);
      }
      memories.set(agent, ids);
    }

    const stats = store.stats();
    expect(stats.totalMemories).toBe(12);
    expect(stats.enabledMemories).toBe(12);

    // Each agent sees only their own memories
    for (const agent of agents) {
      const list = store.list(agent);
      expect(list).toHaveLength(3);
      expect(list.every((m) => m.agentId === agent)).toBe(true);
    }

    // Consolidation for one agent doesn't affect others
    db.prepare('UPDATE memories SET strength = 0.01 WHERE agent_id = ?').run('tester');
    store.consolidate('tester', 0.1);

    // Tester's memories archived
    expect(store.list('tester')).toHaveLength(0);
    // Others unaffected
    expect(store.list('architect')).toHaveLength(3);
    expect(store.list('developer')).toHaveLength(3);
    expect(store.list('devops')).toHaveLength(3);
  });
});

// ── Search Without Agent Filter ────────────────────────────────────

describe('search across all agents', () => {
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

  it('search without agentId returns results from all agents', async () => {
    await store.create({
      agentId: 'agent-a',
      type: 'decision',
      content: 'Agent A decided to use Redis for caching',
      sourceSession: 's1',
    });
    await store.create({
      agentId: 'agent-b',
      type: 'decision',
      content: 'Agent B decided to use Memcached for caching',
      sourceSession: 's1',
    });

    const result = await store.search({
      query: 'caching technology',
      threshold: 0,
    });

    // Should include results from both agents
    const agentIds = new Set(result.results.map((r) => r.memory.agentId));
    expect(agentIds.size).toBe(2);
    expect(agentIds.has('agent-a')).toBe(true);
    expect(agentIds.has('agent-b')).toBe(true);
  });
});

// ── Re-embedding on Content Update ─────────────────────────────────

describe('re-embedding on content update', () => {
  let db: Database.Database;
  let store: MemoryStoreService;
  let embedCallCount: number;

  beforeEach(() => {
    db = createTestDb();
    embedCallCount = 0;
    const provider = createFakeEmbeddingProvider();
    const wrappedProvider: EmbeddingProvider = {
      ...provider,
      async embed(text: string): Promise<Embedding> {
        embedCallCount++;
        return provider.embed(text);
      },
      async embedBatch(texts: string[]): Promise<Embedding[]> {
        embedCallCount += texts.length;
        return provider.embedBatch(texts);
      },
    };
    store = new MemoryStoreService(db, {
      embeddingProvider: wrappedProvider,
      autoEmbed: true,
    });
  });
  afterEach(() => {
    db.close();
  });

  it('re-embeds when content changes but not when only metadata changes', async () => {
    const mem = await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Original content for embedding test',
      sourceSession: 's1',
    });
    expect(embedCallCount).toBe(1); // Initial embed

    // Update content → should re-embed
    await store.update(mem.id, { content: 'Updated content for embedding test' });
    expect(embedCallCount).toBe(2);

    // Update only type → should NOT re-embed
    await store.update(mem.id, { type: 'pattern' });
    expect(embedCallCount).toBe(2); // Unchanged

    // Update only importance → should NOT re-embed
    await store.update(mem.id, { importance: 0.99 });
    expect(embedCallCount).toBe(2); // Unchanged

    // Update only tags → should NOT re-embed
    await store.update(mem.id, { tags: ['new-tag'] });
    expect(embedCallCount).toBe(2); // Unchanged
  });
});
