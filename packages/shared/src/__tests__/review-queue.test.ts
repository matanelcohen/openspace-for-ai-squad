import { beforeEach, describe, expect, it } from 'vitest';

import { HITLManager } from '../escalation/hitl-manager.js';
import { ReviewQueue } from '../escalation/review-queue.js';
import type {
  ConfidenceThreshold,
  EscalationChain,
  EscalationContext,
} from '../types/escalation.js';

// ── Test Fixtures ───────────────────────────────────────────────

function makeChain(overrides?: Partial<EscalationChain>): EscalationChain {
  return {
    id: 'chain-1',
    name: 'Test Chain',
    levels: [
      { level: 1, name: 'L1', reviewerIds: ['alice', 'bob'], timeoutMs: 60_000 },
      { level: 2, name: 'L2', reviewerIds: ['charlie'], timeoutMs: 120_000 },
    ],
    ...overrides,
  };
}

function makeContext(overrides?: Partial<EscalationContext>): EscalationContext {
  return {
    agentId: 'agent-1',
    confidenceScore: 0.3,
    sourceNodeId: 'node-1',
    workflowId: 'wf-1',
    proposedAction: 'deploy',
    reasoning: 'Tests passing',
    metadata: {},
    ...overrides,
  };
}

function createManager(): HITLManager {
  return new HITLManager({
    chains: [makeChain()],
    thresholds: [{ threshold: 0.7, escalationLevel: 1 }] as ConfidenceThreshold[],
    defaultChainId: 'chain-1',
  });
}

function seedItems(manager: HITLManager, count: number) {
  const chain = makeChain();
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push(
      manager.createItem({
        reason: 'explicit_request',
        priority: (['critical', 'high', 'medium', 'low'] as const)[i % 4],
        chain,
        context: makeContext({ agentId: `agent-${i}` }),
        now: `2026-01-01T0${i}:00:00.000Z`,
      }),
    );
  }
  return items;
}

// ── Tests ────────────────────────────────────────────────────────

describe('ReviewQueue', () => {
  let manager: HITLManager;
  let queue: ReviewQueue;

  beforeEach(() => {
    manager = createManager();
    queue = new ReviewQueue(manager);
  });

  // ── query ────────────────────────────────────────────────

  describe('query', () => {
    it('returns all items without filters', () => {
      seedItems(manager, 3);
      const result = queue.query();
      expect(result.length).toBe(3);
    });

    it('returns empty array when no items exist', () => {
      expect(queue.query()).toEqual([]);
    });

    it('filters by single status', () => {
      const items = seedItems(manager, 3);
      manager.claim(items[0].id, 'alice');

      const pending = queue.query({ status: 'pending' });
      expect(pending.length).toBe(2);

      const claimed = queue.query({ status: 'claimed' });
      expect(claimed.length).toBe(1);
    });

    it('filters by multiple statuses', () => {
      const items = seedItems(manager, 3);
      manager.claim(items[0].id, 'alice');
      manager.claim(items[1].id, 'bob');
      manager.approve(items[1].id, 'bob');

      const result = queue.query({ status: ['claimed', 'approved'] });
      expect(result.length).toBe(2);
    });

    it('filters by priority', () => {
      seedItems(manager, 8);
      const critical = queue.query({ priority: 'critical' });
      expect(critical.length).toBe(2);
    });

    it('filters by multiple priorities', () => {
      seedItems(manager, 8);
      const result = queue.query({ priority: ['critical', 'high'] });
      expect(result.length).toBe(4);
    });

    it('filters by chain ID', () => {
      seedItems(manager, 3);
      const result = queue.query({ chainId: 'chain-1' });
      expect(result.length).toBe(3);

      const none = queue.query({ chainId: 'nonexistent' });
      expect(none.length).toBe(0);
    });

    it('filters by date range - createdAfter', () => {
      seedItems(manager, 5);
      const result = queue.query({ createdAfter: '2026-01-01T02:00:00.000Z' });
      expect(result.length).toBe(3); // items 2, 3, 4
    });

    it('filters by date range - createdBefore', () => {
      seedItems(manager, 5);
      const result = queue.query({ createdBefore: '2026-01-01T02:00:00.000Z' });
      // Items 0 (00:00), 1 (01:00), 2 (02:00) — createdBefore uses > so equal timestamp passes
      expect(result.length).toBe(3);
    });

    it('combines multiple filters (AND logic)', () => {
      const items = seedItems(manager, 8);
      manager.claim(items[0].id, 'alice'); // critical, now claimed

      const result = queue.query({
        status: 'pending',
        priority: 'critical',
      });
      // 2 critical items seeded, 1 is claimed → 1 pending critical
      expect(result.length).toBe(1);
    });

    it('sorts by createdAt ascending', () => {
      seedItems(manager, 3);
      const result = queue.query(undefined, { field: 'createdAt', order: 'asc' });
      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i].createdAt).getTime()).toBeGreaterThanOrEqual(
          new Date(result[i - 1].createdAt).getTime(),
        );
      }
    });

    it('sorts by createdAt descending', () => {
      seedItems(manager, 3);
      const result = queue.query(undefined, { field: 'createdAt', order: 'desc' });
      for (let i = 1; i < result.length; i++) {
        expect(new Date(result[i].createdAt).getTime()).toBeLessThanOrEqual(
          new Date(result[i - 1].createdAt).getTime(),
        );
      }
    });

    it('sorts by priority (critical first in asc)', () => {
      seedItems(manager, 8);
      const result = queue.query(undefined, { field: 'priority', order: 'asc' });
      const priorities = result.map((i) => i.priority);
      // critical < high < medium < low in asc order
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 1; i < priorities.length; i++) {
        expect(order[priorities[i]]).toBeGreaterThanOrEqual(order[priorities[i - 1]]);
      }
    });
  });

  // ── pending ──────────────────────────────────────────────

  describe('pending', () => {
    it('returns only pending items', () => {
      const items = seedItems(manager, 3);
      manager.claim(items[0].id, 'alice');

      const pending = queue.pending();
      expect(pending.every((i) => i.status === 'pending')).toBe(true);
      expect(pending.length).toBe(2);
    });

    it('defaults to priority asc sort (critical first)', () => {
      seedItems(manager, 8);
      const pending = queue.pending();
      const order = { critical: 0, high: 1, medium: 2, low: 3 };
      for (let i = 1; i < pending.length; i++) {
        expect(order[pending[i].priority]).toBeGreaterThanOrEqual(order[pending[i - 1].priority]);
      }
    });
  });

  // ── claimed ──────────────────────────────────────────────

  describe('claimed', () => {
    it('returns all claimed items', () => {
      const items = seedItems(manager, 3);
      manager.claim(items[0].id, 'alice');
      manager.claim(items[1].id, 'bob');

      const claimed = queue.claimed();
      expect(claimed.length).toBe(2);
    });

    it('filters by reviewer ID', () => {
      const items = seedItems(manager, 3);
      manager.claim(items[0].id, 'alice');
      manager.claim(items[1].id, 'bob');

      const aliceClaimed = queue.claimed('alice');
      expect(aliceClaimed.length).toBe(1);
      expect(aliceClaimed[0].claimedBy).toBe('alice');
    });

    it('returns empty when no items claimed', () => {
      seedItems(manager, 3);
      expect(queue.claimed()).toEqual([]);
    });
  });

  // ── resolved ─────────────────────────────────────────────

  describe('resolved', () => {
    it('returns approved and rejected items', () => {
      const items = seedItems(manager, 3);
      manager.claim(items[0].id, 'alice');
      manager.approve(items[0].id, 'alice');
      manager.claim(items[1].id, 'bob');
      manager.reject(items[1].id, 'bob');

      const resolved = queue.resolved();
      expect(resolved.length).toBe(2);
      expect(resolved.every((i) => i.status === 'approved' || i.status === 'rejected')).toBe(true);
    });

    it('sorts by updatedAt descending (newest first)', () => {
      const items = seedItems(manager, 3);
      manager.claim(items[0].id, 'alice');
      manager.approve(items[0].id, 'alice');
      manager.claim(items[1].id, 'bob');
      manager.reject(items[1].id, 'bob');

      const resolved = queue.resolved();
      for (let i = 1; i < resolved.length; i++) {
        expect(new Date(resolved[i].updatedAt).getTime()).toBeLessThanOrEqual(
          new Date(resolved[i - 1].updatedAt).getTime(),
        );
      }
    });
  });

  // ── forReviewer ──────────────────────────────────────────

  describe('forReviewer', () => {
    it('returns pending items eligible for the reviewer', () => {
      seedItems(manager, 3);
      const chain = makeChain();

      const forAlice = queue.forReviewer('alice', chain);
      // All items at level 1, alice is in L1 reviewerIds
      expect(forAlice.length).toBe(3);
    });

    it('returns empty for ineligible reviewer', () => {
      seedItems(manager, 3);
      const chain = makeChain();

      // charlie is only in L2
      const forCharlie = queue.forReviewer('charlie', chain);
      expect(forCharlie.length).toBe(0);
    });
  });

  // ── stats ────────────────────────────────────────────────

  describe('stats', () => {
    it('returns zero stats for empty queue', () => {
      const stats = queue.stats();
      expect(stats.total).toBe(0);
      expect(stats.avgResolutionMs).toBeNull();
    });

    it('counts statuses correctly', () => {
      const items = seedItems(manager, 4);
      manager.claim(items[0].id, 'alice');
      manager.approve(items[0].id, 'alice');
      manager.claim(items[1].id, 'bob');
      manager.reject(items[1].id, 'bob');
      manager.claim(items[2].id, 'alice');

      const stats = queue.stats();
      expect(stats.total).toBe(4);
      expect(stats.byStatus.approved).toBe(1);
      expect(stats.byStatus.rejected).toBe(1);
      expect(stats.byStatus.claimed).toBe(1);
      expect(stats.byStatus.pending).toBe(1);
    });

    it('counts priorities correctly', () => {
      seedItems(manager, 8); // 2 of each: critical, high, medium, low
      const stats = queue.stats();
      expect(stats.byPriority.critical).toBe(2);
      expect(stats.byPriority.high).toBe(2);
      expect(stats.byPriority.medium).toBe(2);
      expect(stats.byPriority.low).toBe(2);
    });

    it('calculates average resolution time', () => {
      const items = seedItems(manager, 2);
      manager.claim(items[0].id, 'alice');
      manager.approve(items[0].id, 'alice');

      const stats = queue.stats();
      expect(stats.avgResolutionMs).not.toBeNull();
      expect(stats.avgResolutionMs).toBeGreaterThanOrEqual(0);
    });
  });
});
