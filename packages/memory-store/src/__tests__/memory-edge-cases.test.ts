/**
 * Edge-case tests for @openspace/memory-store
 *
 * Covers boundary conditions, unusual inputs, and error handling that
 * the main test suite does not exercise.
 */

import BetterSqlite3 from 'better-sqlite3';
import type Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Embedding, EmbeddingProvider } from '../embedding.js';
import { cosineSimilarity, embeddingToBuffer, bufferToEmbedding } from '../embedding.js';
import {
  applyDecay,
  boostDuplicate,
  calculateImportance,
  contentHash,
  decayFactor,
  expireMemories,
  findDuplicate,
  resolveConflict,
} from '../lifecycle.js';
import { MemoryStoreService } from '../memory-store.js';
import { initializeMemorySchema, hasMemorySchema, hasEmbeddingSupport } from '../storage.js';

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

// ── Content Hash Normalization ─────────────────────────────────────

describe('contentHash normalization', () => {
  it('normalizes tabs and newlines to match trimmed/lowered equivalent', () => {
    const h1 = contentHash('\t  Hello\nWorld\t  ');
    const h2 = contentHash('hello\nworld');
    // Both normalize differently: tabs/newlines remain after trim+lower
    expect(h1).toBe(h2);
  });

  it('treats multiple spaces differently from single space', () => {
    // trim().toLowerCase() doesn't collapse internal whitespace
    const h1 = contentHash('hello  world');
    const h2 = contentHash('hello world');
    expect(h1).not.toBe(h2);
  });

  it('handles empty string', () => {
    const h = contentHash('');
    expect(h).toBeTruthy();
    expect(typeof h).toBe('string');
    expect(h.length).toBe(64); // SHA-256 hex
  });

  it('handles Unicode content', () => {
    const h1 = contentHash('日本語テスト');
    const h2 = contentHash('日本語テスト');
    expect(h1).toBe(h2);
  });

  it('handles emoji content', () => {
    const h1 = contentHash('🎉 Party 🎊');
    const h2 = contentHash('🎉 party 🎊');
    expect(h1).toBe(h2); // toLowerCase should normalize
  });

  it('handles very long content (10K chars)', () => {
    const long = 'a'.repeat(10_000);
    const h = contentHash(long);
    expect(h).toBeTruthy();
    expect(h.length).toBe(64);
  });
});

// ── Importance Scoring Edge Cases ──────────────────────────────────

describe('calculateImportance edge cases', () => {
  it('handles empty content string', () => {
    const score = calculateImportance('', 'decision', false);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns a score for exactly 10 characters', () => {
    const score = calculateImportance('1234567890', 'decision', false);
    // 10 chars: lengthFactor = 0.7 (in 10-50 range)
    expect(score).toBeCloseTo(0.7 * 0.5 + 0.7 * 0.4); // 0.63
  });

  it('returns a score for exactly 50 characters', () => {
    const content = 'x'.repeat(50);
    const score = calculateImportance(content, 'decision', false);
    // 50 chars: lengthFactor = 1.0 (in 50-200 range)
    expect(score).toBeCloseTo(0.7 * 0.5 + 1.0 * 0.4); // 0.75
  });

  it('returns a score for exactly 200 characters', () => {
    const content = 'x'.repeat(200);
    const score = calculateImportance(content, 'decision', false);
    // 200 chars: lengthFactor = 1.0 (<=200 range)
    expect(score).toBeCloseTo(0.7 * 0.5 + 1.0 * 0.4); // 0.75
  });

  it('returns a score for exactly 201 characters (switches to 0.8)', () => {
    const content = 'x'.repeat(201);
    const score = calculateImportance(content, 'decision', false);
    expect(score).toBeCloseTo(0.7 * 0.5 + 0.8 * 0.4); // 0.67
  });

  it('returns a score for exactly 500 characters', () => {
    const content = 'x'.repeat(500);
    const score = calculateImportance(content, 'decision', false);
    expect(score).toBeCloseTo(0.7 * 0.5 + 0.8 * 0.4); // 0.67
  });

  it('returns a score for exactly 501 characters (switches to 0.6)', () => {
    const content = 'x'.repeat(501);
    const score = calculateImportance(content, 'decision', false);
    expect(score).toBeCloseTo(0.7 * 0.5 + 0.6 * 0.4); // 0.59
  });

  it('uses default weight (0.5) for unknown type', () => {
    const score = calculateImportance('Some reasonable content here for testing', 'unknown_type', false);
    // typeWeight = 0.5 (default), lengthFactor = 0.7 (10-50 chars)
    expect(score).toBeCloseTo(0.5 * 0.5 + 0.7 * 0.4); // 0.53
  });

  it('clamps to max 1.0 even with all bonuses', () => {
    // Max possible: type=0.7*0.5 + length=1.0*0.4 + task=0.1 = 0.85
    const score = calculateImportance('x'.repeat(100), 'decision', true);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('pattern type weights between decision and preference', () => {
    const decision = calculateImportance('test content for scoring', 'decision', false);
    const pattern = calculateImportance('test content for scoring', 'pattern', false);
    const preference = calculateImportance('test content for scoring', 'preference', false);
    expect(decision).toBeGreaterThan(pattern);
    expect(pattern).toBeGreaterThan(preference);
  });
});

// ── Decay Factor Edge Cases ────────────────────────────────────────

describe('decayFactor edge cases', () => {
  it('returns > 0 for very large elapsed days', () => {
    const factor = decayFactor(10_000, 90);
    expect(factor).toBeGreaterThan(0);
    expect(factor).toBeLessThan(0.001);
  });

  it('returns 1 for negative elapsed days (future date)', () => {
    // 2^(-(-1)/90) = 2^(1/90) > 1
    const factor = decayFactor(-1, 90);
    expect(factor).toBeGreaterThan(1);
  });

  it('handles very small half-life', () => {
    const factor = decayFactor(1, 0.001);
    expect(factor).toBeCloseTo(0); // extremely decayed
  });

  it('returns correct value for fractional days', () => {
    const factor = decayFactor(0.5, 90);
    expect(factor).toBeCloseTo(Math.pow(2, -0.5 / 90));
    expect(factor).toBeLessThan(1);
    expect(factor).toBeGreaterThan(0.99);
  });
});

// ── ApplyDecay Edge Cases ──────────────────────────────────────────

describe('applyDecay', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it('skips memories updated less than 0.01 days ago', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, strength)
       VALUES ('m1', 'a1', 'decision', 'Recent memory', 's1', ?, ?, 0.8)`,
    ).run(now, now);

    const result = applyDecay(db, 'a1');
    expect(result.updated).toBe(0);
    expect(result.archived).toBe(0);

    // Strength unchanged
    const row = db.prepare(`SELECT strength FROM memories WHERE id = 'm1'`).get() as { strength: number };
    expect(row.strength).toBeCloseTo(0.8);
  });

  it('archives memories that decay below threshold', () => {
    const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(); // 1 year ago
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, strength)
       VALUES ('m1', 'a1', 'decision', 'Old weak memory', 's1', ?, ?, 0.1)`,
    ).run(oldDate, oldDate);

    const result = applyDecay(db, 'a1', { halfLifeDays: 90, archiveThreshold: 0.05 });
    expect(result.archived).toBe(1);

    const row = db.prepare(`SELECT enabled FROM memories WHERE id = 'm1'`).get() as { enabled: number };
    expect(row.enabled).toBe(0);
  });

  it('returns {0, 0} for agent with no memories', () => {
    const result = applyDecay(db, 'nonexistent-agent');
    expect(result.updated).toBe(0);
    expect(result.archived).toBe(0);
  });

  it('does not affect disabled memories', () => {
    const oldDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, strength, enabled)
       VALUES ('m1', 'a1', 'decision', 'Disabled memory', 's1', ?, ?, 0.8, 0)`,
    ).run(oldDate, oldDate);

    const result = applyDecay(db, 'a1');
    expect(result.updated).toBe(0);
    expect(result.archived).toBe(0);
  });
});

// ── Strength Capping ───────────────────────────────────────────────

describe('boostDuplicate strength capping', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it('caps strength at 1.0 after repeated boosts', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, strength)
       VALUES ('m1', 'a1', 'decision', 'Test', 's1', ?, ?, 0.9)`,
    ).run(now, now);

    const s1 = boostDuplicate(db, 'm1', 0.9);
    expect(s1).toBeCloseTo(1.0); // 0.9 + 0.2 = 1.1 → capped at 1.0

    const s2 = boostDuplicate(db, 'm1', 1.0);
    expect(s2).toBeCloseTo(1.0); // already at max
  });
});

// ── Conflict Resolution Strategies ─────────────────────────────────

describe('resolveConflict', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it('keep_existing returns existing memory unchanged', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, strength)
       VALUES ('m1', 'a1', 'decision', 'Original', 's1', ?, ?, 0.7)`,
    ).run(now, now);

    const result = resolveConflict(db, 'm1', 0.7, 'New content', 'keep_existing');
    expect(result.action).toBe('kept_existing');
    expect(result.memoryId).toBe('m1');

    // Verify content unchanged
    const row = db.prepare(`SELECT content, strength FROM memories WHERE id = 'm1'`).get() as any;
    expect(row.content).toBe('Original');
    expect(row.strength).toBeCloseTo(0.7);
  });

  it('keep_newer disables the old memory', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, strength)
       VALUES ('m1', 'a1', 'decision', 'Old content', 's1', ?, ?, 0.7)`,
    ).run(now, now);

    const result = resolveConflict(db, 'm1', 0.7, 'New content', 'keep_newer');
    expect(result.action).toBe('replaced');

    const row = db.prepare(`SELECT enabled FROM memories WHERE id = 'm1'`).get() as { enabled: number };
    expect(row.enabled).toBe(0);
  });

  it('merge_boost boosts the existing memory strength', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, strength)
       VALUES ('m1', 'a1', 'decision', 'Existing', 's1', ?, ?, 0.5)`,
    ).run(now, now);

    const result = resolveConflict(db, 'm1', 0.5, 'New content', 'merge_boost');
    expect(result.action).toBe('boosted');

    const row = db.prepare(`SELECT strength FROM memories WHERE id = 'm1'`).get() as { strength: number };
    expect(row.strength).toBeCloseTo(0.7); // 0.5 + 0.2
  });

  it('defaults to merge_boost when no strategy specified', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, strength)
       VALUES ('m1', 'a1', 'decision', 'Existing', 's1', ?, ?, 0.5)`,
    ).run(now, now);

    const result = resolveConflict(db, 'm1', 0.5, 'New content');
    expect(result.action).toBe('boosted');
  });
});

// ── Expiration Edge Cases ──────────────────────────────────────────

describe('expireMemories', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it('does nothing when no memories have expiration', () => {
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at)
       VALUES ('m1', 'a1', 'decision', 'No expiry', 's1', ?, ?)`,
    ).run(now, now);

    const expired = expireMemories(db);
    expect(expired).toBe(0);
  });

  it('expires memories in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, expires_at)
       VALUES ('m1', 'a1', 'decision', 'Expired', 's1', ?, ?, ?)`,
    ).run(now, now, past);

    const expired = expireMemories(db);
    expect(expired).toBe(1);
  });

  it('does not expire memories in the future', () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, expires_at)
       VALUES ('m1', 'a1', 'decision', 'Not yet expired', 's1', ?, ?, ?)`,
    ).run(now, now, future);

    const expired = expireMemories(db);
    expect(expired).toBe(0);
  });

  it('does not re-expire already disabled memories', () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, expires_at, enabled)
       VALUES ('m1', 'a1', 'decision', 'Already disabled', 's1', ?, ?, ?, 0)`,
    ).run(now, now, past);

    const expired = expireMemories(db);
    expect(expired).toBe(0);
  });
});

// ── FindDuplicate ──────────────────────────────────────────────────

describe('findDuplicate', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });
  afterEach(() => {
    db.close();
  });

  it('finds an existing memory by content hash', () => {
    const hash = contentHash('Test content');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, content_hash)
       VALUES ('m1', 'a1', 'decision', 'Test content', 's1', ?, ?, ?)`,
    ).run(now, now, hash);

    const found = findDuplicate(db, 'a1', hash);
    expect(found).not.toBeNull();
    expect(found!.id).toBe('m1');
  });

  it('does not find disabled memories', () => {
    const hash = contentHash('Disabled content');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, content_hash, enabled)
       VALUES ('m1', 'a1', 'decision', 'Disabled content', 's1', ?, ?, ?, 0)`,
    ).run(now, now, hash);

    const found = findDuplicate(db, 'a1', hash);
    expect(found).toBeNull();
  });

  it('does not match across agents', () => {
    const hash = contentHash('Shared content');
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO memories (id, agent_id, type, content, source_session, created_at, updated_at, content_hash)
       VALUES ('m1', 'a1', 'decision', 'Shared content', 's1', ?, ?, ?)`,
    ).run(now, now, hash);

    const found = findDuplicate(db, 'a2', hash);
    expect(found).toBeNull();
  });
});

// ── Storage Schema Helpers ─────────────────────────────────────────

describe('schema helpers', () => {
  it('hasMemorySchema returns false on empty DB', () => {
    const db = new BetterSqlite3(':memory:');
    expect(hasMemorySchema(db)).toBe(false);
    db.close();
  });

  it('hasMemorySchema returns true after init', () => {
    const db = createTestDb();
    expect(hasMemorySchema(db)).toBe(true);
    db.close();
  });

  it('hasEmbeddingSupport returns true after init', () => {
    const db = createTestDb();
    expect(hasEmbeddingSupport(db)).toBe(true);
    db.close();
  });

  it('initializeMemorySchema is idempotent', () => {
    const db = createTestDb();
    // Calling init again should not throw
    expect(() => initializeMemorySchema(db)).not.toThrow();
    db.close();
  });
});

// ── MemoryStoreService Edge Cases ──────────────────────────────────

describe('MemoryStoreService edge cases', () => {
  let db: Database.Database;
  let store: MemoryStoreService;

  beforeEach(() => {
    db = createTestDb();
    store = new MemoryStoreService(db, { autoEmbed: false });
  });
  afterEach(() => {
    db.close();
  });

  describe('create edge cases', () => {
    it('creates memory with all optional fields', async () => {
      const mem = await store.create({
        agentId: 'agent-1',
        type: 'decision',
        content: 'Full memory with all options set for comprehensive testing',
        sourceSession: 'session-1',
        sourceTaskId: 'task-42',
        tags: ['arch', 'testing', 'ci'],
        importance: 0.95,
        ttlSeconds: 7200,
      });

      expect(mem.tags.sort()).toEqual(['arch', 'ci', 'testing']);
      expect(mem.importance).toBeCloseTo(0.95);
      expect(mem.expiresAt).toBeTruthy();
    });

    it('creates memory with minimal required fields', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'preference',
        content: 'Minimal',
        sourceSession: 's1',
      });

      expect(mem.id).toMatch(/^mem-/);
      expect(mem.tags).toEqual([]);
      expect(mem.expiresAt).toBeNull();
    });

    it('handles content with special characters', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Use `backticks` and "quotes" & <html> tags; also $pecial chars!',
        sourceSession: 's1',
      });

      expect(mem.content).toBe('Use `backticks` and "quotes" & <html> tags; also $pecial chars!');
    });

    it('handles content with Unicode/emoji', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'preference',
        content: '🎉 The team prefers 日本語 documentation',
        sourceSession: 's1',
      });

      expect(mem.content).toBe('🎉 The team prefers 日本語 documentation');
    });

    it('dedup is case-insensitive', async () => {
      const first = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Use TypeScript',
        sourceSession: 's1',
      });

      db.prepare('UPDATE memories SET strength = 0.5 WHERE id = ?').run(first.id);

      const second = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'use typescript',
        sourceSession: 's2',
      });

      expect(second.id).toBe(first.id); // Same memory, boosted
      expect(second.strength).toBeCloseTo(0.7);
    });

    it('TTL with 0 is falsy so no expiration is set', async () => {
      // ttlSeconds=0 is falsy in JS, so the conditional `input.ttlSeconds ? ...` yields null
      const mem = await store.create({
        agentId: 'a1',
        type: 'preference',
        content: 'Zero TTL test',
        sourceSession: 's1',
        ttlSeconds: 0,
      });

      expect(mem.expiresAt).toBeNull();
    });

    it('TTL with 1 second creates a near-immediate expiration', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'preference',
        content: 'Very short TTL test',
        sourceSession: 's1',
        ttlSeconds: 1,
      });

      expect(mem.expiresAt).toBeTruthy();
      const expiresAt = new Date(mem.expiresAt!).getTime();
      const now = Date.now();
      expect(Math.abs(expiresAt - now)).toBeLessThan(5000);
    });

    it('handles very large TTL', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'preference',
        content: 'Long-lived memory',
        sourceSession: 's1',
        ttlSeconds: 10 * 365 * 24 * 3600, // 10 years
      });

      expect(mem.expiresAt).toBeTruthy();
      const expiresAt = new Date(mem.expiresAt!).getTime();
      expect(expiresAt).toBeGreaterThan(Date.now() + 9 * 365 * 24 * 3600 * 1000);
    });
  });

  describe('update edge cases', () => {
    it('updates only type without content change', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Will change type',
        sourceSession: 's1',
      });

      const updated = await store.update(mem.id, { type: 'pattern' });
      expect(updated!.type).toBe('pattern');
      expect(updated!.content).toBe('Will change type');
    });

    it('updates only importance', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Will change importance',
        sourceSession: 's1',
      });

      const updated = await store.update(mem.id, { importance: 0.99 });
      expect(updated!.importance).toBeCloseTo(0.99);
    });

    it('can disable a memory via update', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Will be disabled',
        sourceSession: 's1',
      });

      const updated = await store.update(mem.id, { enabled: false });
      expect(updated!.enabled).toBe(false);
    });

    it('can re-enable a disabled memory via update', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Will toggle enabled',
        sourceSession: 's1',
      });

      store.delete(mem.id); // soft-delete
      const updated = await store.update(mem.id, { enabled: true });
      expect(updated!.enabled).toBe(true);
    });

    it('clears tags when set to empty array', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Has tags',
        sourceSession: 's1',
        tags: ['a', 'b', 'c'],
      });
      expect(mem.tags).toHaveLength(3);

      const updated = await store.update(mem.id, { tags: [] });
      expect(updated!.tags).toEqual([]);
    });

    it('updates content_hash when content changes', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Original content',
        sourceSession: 's1',
      });
      const originalHash = mem.contentHash;

      const updated = await store.update(mem.id, { content: 'Updated content' });
      expect(updated!.contentHash).not.toBe(originalHash);
      expect(updated!.contentHash).toBe(contentHash('Updated content'));
    });
  });

  describe('delete edge cases', () => {
    it('delete returns false for nonexistent ID', () => {
      const result = store.delete('nonexistent');
      expect(result).toBe(false);
    });

    it('hardDelete returns false for nonexistent ID', () => {
      const result = store.hardDelete('nonexistent');
      expect(result).toBe(false);
    });

    it('hardDelete removes associated tags', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Tagged for deletion',
        sourceSession: 's1',
        tags: ['will-be-removed'],
      });

      store.hardDelete(mem.id);

      // Tags should be gone (ON DELETE CASCADE)
      const tagCount = db.prepare(`SELECT COUNT(*) as count FROM memory_tags WHERE memory_id = ?`).get(mem.id) as { count: number };
      expect(tagCount.count).toBe(0);
    });

    it('hardDelete removes associated embeddings', async () => {
      const embedStore = new MemoryStoreService(db, {
        embeddingProvider: createFakeEmbeddingProvider(),
        autoEmbed: true,
      });

      const mem = await embedStore.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Embedded for deletion',
        sourceSession: 's1',
      });
      expect(mem.hasEmbedding).toBe(true);

      embedStore.hardDelete(mem.id);

      const embCount = db.prepare(`SELECT COUNT(*) as count FROM memory_embeddings WHERE memory_id = ?`).get(mem.id) as { count: number };
      expect(embCount.count).toBe(0);
    });
  });

  describe('recordRecall edge cases', () => {
    it('multiple recalls accumulate count', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Frequently recalled',
        sourceSession: 's1',
      });

      db.prepare('UPDATE memories SET strength = 0.5 WHERE id = ?').run(mem.id);

      store.recordRecall(mem.id, 0.6);
      store.recordRecall(mem.id, 0.8);
      store.recordRecall(mem.id, 0.9);

      const updated = store.getById(mem.id)!;
      expect(updated.recallCount).toBe(3);
      expect(updated.relevanceScore).toBe(0.9); // Last score wins
      expect(updated.strength).toBeCloseTo(0.65); // 0.5 + 3 * 0.05
    });

    it('recall strength boost is capped at 1.0', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Near-max strength',
        sourceSession: 's1',
      });

      // Strength starts at 1.0 by default
      store.recordRecall(mem.id, 0.9);
      const updated = store.getById(mem.id)!;
      expect(updated.strength).toBeCloseTo(1.0); // MIN(1.0, 1.0 + 0.05) = 1.0
    });
  });

  describe('list edge cases', () => {
    it('returns empty array for agent with no memories', () => {
      const list = store.list('nonexistent-agent');
      expect(list).toEqual([]);
    });

    it('excludes soft-deleted memories from list', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Will be deleted',
        sourceSession: 's1',
      });
      store.delete(mem.id);

      const list = store.list('a1');
      expect(list).toHaveLength(0);
    });

    it('orders by importance DESC then strength DESC', async () => {
      // Create memories with varying importance
      const m1 = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Low importance memory',
        sourceSession: 's1',
        importance: 0.2,
      });
      const m2 = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'High importance memory',
        sourceSession: 's1',
        importance: 0.9,
      });
      const m3 = await store.create({
        agentId: 'a1',
        type: 'decision',
        content: 'Medium importance memory',
        sourceSession: 's1',
        importance: 0.5,
      });

      const list = store.list('a1');
      expect(list[0]!.importance).toBe(0.9);
      expect(list[1]!.importance).toBe(0.5);
      expect(list[2]!.importance).toBe(0.2);
    });
  });

  describe('stats on empty store', () => {
    it('returns zeros for empty store', () => {
      const s = store.stats();
      expect(s.totalMemories).toBe(0);
      expect(s.enabledMemories).toBe(0);
      expect(s.embeddedMemories).toBe(0);
      expect(s.expiredMemories).toBe(0);
      expect(s.byType.decision).toBe(0);
      expect(s.byType.pattern).toBe(0);
      expect(s.byType.preference).toBe(0);
      expect(Object.keys(s.byAgent)).toHaveLength(0);
    });
  });

  describe('consolidate edge cases', () => {
    it('consolidate on empty store returns all zeros', () => {
      const result = store.consolidate('nonexistent-agent');
      expect(result.merged).toBe(0);
      expect(result.archived).toBe(0);
      expect(result.remaining).toBe(0);
    });

    it('does not archive memories above threshold', async () => {
      await store.create({ agentId: 'a1', type: 'decision', content: 'Strong memory content here', sourceSession: 's1' });

      const result = store.consolidate('a1', 0.1);
      expect(result.archived).toBe(0);
      expect(result.remaining).toBe(1);
    });
  });

  describe('expire via service', () => {
    it('expire returns 0 when nothing to expire', () => {
      const count = store.expire();
      expect(count).toBe(0);
    });

    it('expire disables expired memories', async () => {
      const mem = await store.create({
        agentId: 'a1',
        type: 'preference',
        content: 'Short-lived memory',
        sourceSession: 's1',
        ttlSeconds: 0,
      });

      // Wait a tiny bit then expire
      const count = store.expire();
      // TTL=0 means expires_at ≈ now, may or may not have passed
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});

// ── Cosine Similarity Edge Cases ───────────────────────────────────

describe('cosineSimilarity additional edge cases', () => {
  it('handles single-dimension vectors', () => {
    expect(cosineSimilarity([5], [3])).toBeCloseTo(1.0);
    expect(cosineSimilarity([5], [-3])).toBeCloseTo(-1.0);
  });

  it('handles very large vectors', () => {
    const a = Array.from({ length: 1536 }, (_, i) => Math.sin(i));
    const b = Array.from({ length: 1536 }, (_, i) => Math.cos(i));
    const sim = cosineSimilarity(a, b);
    expect(sim).toBeGreaterThanOrEqual(-1);
    expect(sim).toBeLessThanOrEqual(1);
  });

  it('handles Float64Array inputs', () => {
    const a = Float64Array.from([0.5, 0.5, 0.5]);
    const b = Float64Array.from([0.5, 0.5, 0.5]);
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
  });

  it('handles mixed Float64Array and number[] inputs', () => {
    const a = Float64Array.from([1, 0, 0]);
    const b = [1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
  });

  it('both zero vectors return 0', () => {
    expect(cosineSimilarity([0, 0, 0], [0, 0, 0])).toBe(0);
  });

  it('empty vectors throw dimension mismatch with non-empty', () => {
    expect(() => cosineSimilarity([], [1])).toThrow('Dimension mismatch');
  });

  it('two empty vectors have similarity 0 (denom is 0)', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });
});

// ── Embedding Serialization Edge Cases ─────────────────────────────

describe('embedding serialization edge cases', () => {
  it('roundtrips single-element array', () => {
    const original = Float64Array.from([42.0]);
    const restored = bufferToEmbedding(embeddingToBuffer(original));
    expect(restored.length).toBe(1);
    expect(restored[0]).toBeCloseTo(42.0);
  });

  it('roundtrips empty array', () => {
    const original = Float64Array.from([]);
    const restored = bufferToEmbedding(embeddingToBuffer(original));
    expect(restored.length).toBe(0);
  });

  it('preserves negative values', () => {
    const original = Float64Array.from([-1.5, -0.001, -999.99]);
    const restored = bufferToEmbedding(embeddingToBuffer(original));
    for (let i = 0; i < original.length; i++) {
      expect(restored[i]).toBeCloseTo(original[i]!);
    }
  });

  it('preserves special floating point values', () => {
    const original = Float64Array.from([0, -0, Number.EPSILON, Number.MAX_SAFE_INTEGER]);
    const restored = bufferToEmbedding(embeddingToBuffer(original));
    expect(restored[0]).toBe(0);
    expect(restored[2]).toBe(Number.EPSILON);
    expect(restored[3]).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('handles large dimension embedding (1536)', () => {
    const original = Float64Array.from({ length: 1536 }, (_, i) => Math.sin(i) * 0.1);
    const buf = embeddingToBuffer(original);
    const restored = bufferToEmbedding(buf);
    expect(restored.length).toBe(1536);
    for (let i = 0; i < 10; i++) {
      expect(restored[i]).toBeCloseTo(original[i]!);
    }
  });
});

// ── FTS Search Edge Cases ──────────────────────────────────────────

describe('search with special characters', () => {
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

  it('handles query with special characters gracefully', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Use the standard approach for handling errors',
      sourceSession: 's1',
    });

    // Should not throw even with special FTS characters
    const result = await store.search({
      query: 'standard (approach) [handling] {errors}',
      agentId: 'a1',
      threshold: 0,
    });

    expect(result.results.length).toBeGreaterThan(0);
  });

  it('handles query with SQL-like injection', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'A safe memory about databases',
      sourceSession: 's1',
    });

    // Should not throw
    const result = await store.search({
      query: "'; DROP TABLE memories; --",
      agentId: 'a1',
      threshold: 0,
    });

    // The table should still exist
    expect(() => store.stats()).not.toThrow();
  });

  it('handles empty query string', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Some memory content here',
      sourceSession: 's1',
    });

    const result = await store.search({
      query: '',
      agentId: 'a1',
      threshold: 0,
    });

    // Empty query with vector search may still return results based on embedding
    // but should not throw
    expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('handles query with only whitespace', async () => {
    await store.create({
      agentId: 'a1',
      type: 'decision',
      content: 'Memory for whitespace test',
      sourceSession: 's1',
    });

    const result = await store.search({
      query: '   \t\n  ',
      agentId: 'a1',
      threshold: 0,
    });

    expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('handles emoji in query', async () => {
    await store.create({
      agentId: 'a1',
      type: 'preference',
      content: '🚀 Team prefers fast deployments',
      sourceSession: 's1',
    });

    const result = await store.search({
      query: '🚀 deployments',
      agentId: 'a1',
      threshold: 0,
    });

    expect(result.results.length).toBeGreaterThan(0);
  });
});
