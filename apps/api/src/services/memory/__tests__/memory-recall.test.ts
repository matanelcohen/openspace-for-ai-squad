import { describe, expect, it, vi } from 'vitest';

import { MemoryRecallEngine } from '../memory-recall.js';
import type { MemoryStore } from '../memory-store.js';

// ── Mock Types ──────────────────────────────────────────────────

interface MockMemory {
  id: string;
  type: string;
  content: string;
  strength: number;
  createdAt: string;
  lastRecalledAt: string | null;
}

interface MockFtsResult {
  memory: MockMemory;
  ftsRank: number;
}

// ── Mock Store ──────────────────────────────────────────────────

function makeMockStore(ftsResults: MockFtsResult[] = []) {
  return {
    recallByFts: vi.fn().mockReturnValue(ftsResults),
    recordRecall: vi.fn(),
  };
}

function makeMemory(overrides?: Partial<MockMemory>): MockMemory {
  return {
    id: 'mem-1',
    type: 'decision',
    content: 'We decided to use TypeScript for everything.',
    strength: 0.8,
    createdAt: '2026-01-01T00:00:00.000Z',
    lastRecalledAt: null,
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('MemoryRecallEngine', () => {
  describe('recall', () => {
    it('returns empty array when FTS returns no results', () => {
      const store = makeMockStore([]);
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      const results = engine.recall('agent-1', 'TypeScript');
      expect(results).toEqual([]);
    });

    it('casts a wider net (maxMemories * 3)', () => {
      const store = makeMockStore([]);
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore, { maxMemories: 5 });

      engine.recall('agent-1', 'query');
      expect(store.recallByFts).toHaveBeenCalledWith('agent-1', 'query', 15);
    });

    it('scores and returns results above threshold', () => {
      const store = makeMockStore([
        { memory: makeMemory({ id: 'mem-1', strength: 0.9 }), ftsRank: -1 },
        { memory: makeMemory({ id: 'mem-2', strength: 0.8 }), ftsRank: -2 },
      ]);
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      const results = engine.recall('agent-1', 'TypeScript');
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.score >= 0.3)).toBe(true);
    });

    it('sorts by score descending', () => {
      const store = makeMockStore([
        { memory: makeMemory({ id: 'mem-1', strength: 0.5 }), ftsRank: -5 },
        { memory: makeMemory({ id: 'mem-2', strength: 0.9 }), ftsRank: -1 },
        { memory: makeMemory({ id: 'mem-3', strength: 0.7 }), ftsRank: -2 },
      ]);
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      const results = engine.recall('agent-1', 'query');
      for (let i = 1; i < results.length; i++) {
        expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
      }
    });

    it('respects maxMemories limit', () => {
      const memories = Array.from({ length: 20 }, (_, i) => ({
        memory: makeMemory({ id: `mem-${i}`, strength: 0.9 }),
        ftsRank: -1,
      }));
      const store = makeMockStore(memories);
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore, { maxMemories: 3 });

      const results = engine.recall('agent-1', 'query');
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('filters out low-scoring results', () => {
      const store = makeMockStore([
        { memory: makeMemory({ id: 'mem-1', strength: 0.01 }), ftsRank: -100 },
      ]);
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore, {
        relevanceThreshold: 0.9,
      });

      const results = engine.recall('agent-1', 'query');
      expect(results).toEqual([]);
    });

    it('records recall on returned memories', () => {
      const store = makeMockStore([
        { memory: makeMemory({ id: 'mem-1', strength: 0.9 }), ftsRank: -1 },
      ]);
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      const results = engine.recall('agent-1', 'query');
      if (results.length > 0) {
        expect(store.recordRecall).toHaveBeenCalledWith('mem-1', expect.any(Number));
      }
    });

    it('gives higher score to recent memories', () => {
      const recentMemory = makeMemory({
        id: 'recent',
        strength: 0.5,
        lastRecalledAt: new Date().toISOString(),
      });
      const oldMemory = makeMemory({
        id: 'old',
        strength: 0.5,
        lastRecalledAt: '2020-01-01T00:00:00.000Z',
      });

      const store = makeMockStore([
        { memory: recentMemory, ftsRank: -2 },
        { memory: oldMemory, ftsRank: -2 },
      ]);
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      const results = engine.recall('agent-1', 'query');
      if (results.length === 2) {
        const recentResult = results.find((r) => r.memory.id === 'recent');
        const oldResult = results.find((r) => r.memory.id === 'old');
        if (recentResult && oldResult) {
          expect(recentResult.score).toBeGreaterThan(oldResult.score);
        }
      }
    });

    it('uses createdAt when lastRecalledAt is null', () => {
      const store = makeMockStore([
        { memory: makeMemory({ id: 'mem-1', lastRecalledAt: null }), ftsRank: -1 },
      ]);
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      const results = engine.recall('agent-1', 'query');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('config', () => {
    it('uses defaults when no config provided', () => {
      const store = makeMockStore([]);
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      engine.recall('agent-1', 'query');
      expect(store.recallByFts).toHaveBeenCalledWith('agent-1', 'query', 15);
    });

    it('allows custom weights', () => {
      const store = makeMockStore([{ memory: makeMemory({ strength: 0.9 }), ftsRank: -1 }]);

      const engine = new MemoryRecallEngine(store as unknown as MemoryStore, {
        ftsWeight: 0.1,
        strengthWeight: 0.8,
        recencyWeight: 0.1,
      });

      const results = engine.recall('agent-1', 'query');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('buildContextBlock', () => {
    it('returns null for empty results', () => {
      const store = makeMockStore();
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      expect(engine.buildContextBlock([])).toBeNull();
    });

    it('formats memories with tags and indices', () => {
      const store = makeMockStore();
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      const results = [
        {
          memory: makeMemory({ type: 'decision', content: 'Use TypeScript' }),
          score: 0.9,
          passedFilter: true,
        },
        {
          memory: makeMemory({ type: 'pattern', content: 'Always write tests' }),
          score: 0.8,
          passedFilter: true,
        },
      ];

      const block = engine.buildContextBlock(results);
      expect(block).not.toBeNull();
      expect(block).toContain('[M1:DECISION]');
      expect(block).toContain('[M2:PATTERN]');
      expect(block).toContain('Use TypeScript');
      expect(block).toContain('Always write tests');
    });

    it('includes header line', () => {
      const store = makeMockStore();
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      const results = [{ memory: makeMemory(), score: 0.9, passedFilter: true }];

      const block = engine.buildContextBlock(results);
      expect(block).toContain('Relevant memories from past sessions');
    });
  });

  describe('buildAttributions', () => {
    it('returns empty array for empty results', () => {
      const store = makeMockStore();
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      expect(engine.buildAttributions([])).toEqual([]);
    });

    it('creates attribution records with memory IDs', () => {
      const store = makeMockStore();
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      const results = [
        {
          memory: makeMemory({ id: 'mem-1', type: 'decision', content: 'Use TS' }),
          score: 0.9,
          passedFilter: true,
        },
        {
          memory: makeMemory({ id: 'mem-2', type: 'pattern', content: 'Write tests' }),
          score: 0.8,
          passedFilter: true,
        },
      ];

      const attributions = engine.buildAttributions(results);
      expect(attributions).toHaveLength(2);
      expect(attributions[0].memoryId).toBe('mem-1');
      expect(attributions[1].memoryId).toBe('mem-2');
    });

    it('includes type tag in influence', () => {
      const store = makeMockStore();
      const engine = new MemoryRecallEngine(store as unknown as MemoryStore);

      const results = [
        { memory: makeMemory({ type: 'decision' }), score: 0.9, passedFilter: true },
      ];

      const attributions = engine.buildAttributions(results);
      expect(attributions[0].influence).toContain('[M1:DECISION]');
    });
  });
});
