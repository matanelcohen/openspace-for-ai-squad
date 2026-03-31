/**
 * Comprehensive unit tests for the pure escalation functions in escalation/index.ts.
 *
 * Covers: evaluateConfidence, isAtThresholdBoundary, calculateTimeout, isTimedOut,
 * remainingTimeMs, resolveChainLevel, getNextChainLevel, isReviewerEligible,
 * createEscalationItem, claimEscalationItem, approveEscalationItem,
 * rejectEscalationItem, autoEscalate, serializeQueueState, deserializeQueueState,
 * validateContext, generateId.
 */

import { describe, expect, it } from 'vitest';

import {
  approveEscalationItem,
  autoEscalate,
  calculateTimeout,
  claimEscalationItem,
  createEscalationItem,
  deserializeQueueState,
  evaluateConfidence,
  generateId,
  getNextChainLevel,
  isAtThresholdBoundary,
  isReviewerEligible,
  isTimedOut,
  rejectEscalationItem,
  remainingTimeMs,
  resolveChainLevel,
  serializeQueueState,
  validateContext,
} from '../escalation/index.js';
import type {
  ConfidenceThreshold,
  EscalationChain,
  EscalationContext,
  EscalationItem,
} from '../types/escalation.js';

// ── Test Fixtures ───────────────────────────────────────────────

function makeChain(overrides?: Partial<EscalationChain>): EscalationChain {
  return {
    id: 'chain-test',
    name: 'Test Chain',
    levels: [
      { level: 1, name: 'L1', reviewerIds: ['alice', 'bob'], timeoutMs: 60_000 },
      { level: 2, name: 'L2', reviewerIds: ['charlie'], timeoutMs: 120_000 },
      { level: 3, name: 'L3', reviewerIds: ['diana'], timeoutMs: 300_000 },
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
    proposedAction: 'deploy to prod',
    reasoning: 'Low confidence in test results',
    metadata: {},
    ...overrides,
  };
}

function makeThresholds(): ConfidenceThreshold[] {
  return [
    { threshold: 0.7, escalationLevel: 1 },
    { threshold: 0.4, escalationLevel: 2 },
    { threshold: 0.1, escalationLevel: 3 },
  ];
}

function makePendingItem(overrides?: Partial<EscalationItem>): EscalationItem {
  const item = createEscalationItem({
    reason: 'explicit_request',
    priority: 'medium',
    chain: makeChain(),
    context: makeContext(),
    now: '2026-01-01T00:00:00.000Z',
  });
  return { ...item, ...overrides };
}

function makeClaimedItem(): EscalationItem {
  const pending = makePendingItem();
  return claimEscalationItem(pending, 'alice', makeChain(), '2026-01-01T00:01:00.000Z');
}

// ── generateId ──────────────────────────────────────────────────

describe('generateId', () => {
  it('generates unique IDs with given prefix', () => {
    const id1 = generateId('esc');
    const id2 = generateId('esc');
    expect(id1).not.toBe(id2);
    expect(id1.startsWith('esc-')).toBe(true);
    expect(id2.startsWith('esc-')).toBe(true);
  });

  it('handles different prefixes', () => {
    const esc = generateId('esc');
    const audit = generateId('audit');
    expect(esc.startsWith('esc-')).toBe(true);
    expect(audit.startsWith('audit-')).toBe(true);
  });

  it('generates IDs with timestamp component', () => {
    const id = generateId('test');
    const parts = id.split('-');
    expect(parts.length).toBeGreaterThanOrEqual(2);
  });
});

// ── evaluateConfidence ──────────────────────────────────────────

describe('evaluateConfidence', () => {
  const thresholds = makeThresholds();

  describe('basic matching', () => {
    it('returns matching threshold for low score', () => {
      const result = evaluateConfidence(0.05, thresholds);
      expect(result).not.toBeNull();
      expect(result!.escalationLevel).toBe(1); // highest threshold that matches
    });

    it('returns null when above all thresholds', () => {
      expect(evaluateConfidence(0.9, thresholds)).toBeNull();
    });

    it('returns null when exactly at threshold (not below)', () => {
      expect(evaluateConfidence(0.7, thresholds)).toBeNull();
    });

    it('triggers when just below threshold', () => {
      const result = evaluateConfidence(0.699, thresholds);
      expect(result).not.toBeNull();
    });

    it('returns highest matching threshold (least strict)', () => {
      // Score 0.3 is below 0.7 and 0.4, should return 0.7 (highest)
      const result = evaluateConfidence(0.3, thresholds);
      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(0.7);
    });
  });

  describe('boundary conditions', () => {
    it('handles score of exactly 0', () => {
      const result = evaluateConfidence(0, thresholds);
      expect(result).not.toBeNull();
    });

    it('handles score of exactly 1', () => {
      expect(evaluateConfidence(1, thresholds)).toBeNull();
    });

    it('handles empty thresholds array', () => {
      expect(evaluateConfidence(0.5, [])).toBeNull();
    });

    it('handles single threshold', () => {
      const single: ConfidenceThreshold[] = [{ threshold: 0.5, escalationLevel: 1 }];
      expect(evaluateConfidence(0.3, single)).not.toBeNull();
      expect(evaluateConfidence(0.7, single)).toBeNull();
    });
  });

  describe('validation', () => {
    it('throws for NaN score', () => {
      expect(() => evaluateConfidence(NaN, thresholds)).toThrow('Invalid confidence score');
    });

    it('throws for Infinity', () => {
      expect(() => evaluateConfidence(Infinity, thresholds)).toThrow('Invalid confidence score');
    });

    it('throws for negative score', () => {
      expect(() => evaluateConfidence(-0.1, thresholds)).toThrow('must be between 0 and 1');
    });

    it('throws for score > 1', () => {
      expect(() => evaluateConfidence(1.1, thresholds)).toThrow('must be between 0 and 1');
    });
  });

  describe('agent role filtering', () => {
    const roleThresholds: ConfidenceThreshold[] = [
      { threshold: 0.8, escalationLevel: 1, agentRoles: ['tester'] },
      { threshold: 0.5, escalationLevel: 2 }, // no role restriction
    ];

    it('matches role-specific threshold for matching role', () => {
      const result = evaluateConfidence(0.6, roleThresholds, 'tester');
      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(0.8);
    });

    it('skips role-specific threshold for non-matching role', () => {
      const result = evaluateConfidence(0.6, roleThresholds, 'developer');
      expect(result).toBeNull(); // 0.6 is above 0.5 threshold
    });

    it('applies general thresholds when no agentRole provided', () => {
      const result = evaluateConfidence(0.3, roleThresholds);
      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(0.5); // role-specific excluded, general matches
    });

    it('skips role-restricted thresholds when no agentRole provided', () => {
      const result = evaluateConfidence(0.6, roleThresholds);
      expect(result).toBeNull(); // role-specific excluded, 0.6 above general 0.5
    });

    it('handles multiple roles on a threshold', () => {
      const multiRole: ConfidenceThreshold[] = [
        { threshold: 0.9, escalationLevel: 1, agentRoles: ['tester', 'reviewer'] },
      ];
      expect(evaluateConfidence(0.5, multiRole, 'tester')).not.toBeNull();
      expect(evaluateConfidence(0.5, multiRole, 'reviewer')).not.toBeNull();
      expect(evaluateConfidence(0.5, multiRole, 'developer')).toBeNull();
    });

    it('handles empty agentRoles array as general (not role-restricted)', () => {
      const emptyRoles: ConfidenceThreshold[] = [
        { threshold: 0.8, escalationLevel: 1, agentRoles: [] },
      ];
      // Empty roles array → length check is false → falls to general match
      const result = evaluateConfidence(0.5, emptyRoles);
      expect(result).not.toBeNull();
      expect(result!.threshold).toBe(0.8);
    });
  });
});

// ── isAtThresholdBoundary ───────────────────────────────────────

describe('isAtThresholdBoundary', () => {
  const thresholds = makeThresholds();

  it('returns true when score equals a threshold exactly', () => {
    expect(isAtThresholdBoundary(0.7, thresholds)).toBe(true);
    expect(isAtThresholdBoundary(0.4, thresholds)).toBe(true);
    expect(isAtThresholdBoundary(0.1, thresholds)).toBe(true);
  });

  it('returns false when not at any boundary', () => {
    expect(isAtThresholdBoundary(0.5, thresholds)).toBe(false);
    expect(isAtThresholdBoundary(0.35, thresholds)).toBe(false);
  });

  it('returns false for empty thresholds', () => {
    expect(isAtThresholdBoundary(0.5, [])).toBe(false);
  });

  it('handles floating point edge cases', () => {
    // Exact match required
    expect(isAtThresholdBoundary(0.70000000000001, thresholds)).toBe(false);
  });
});

// ── calculateTimeout ────────────────────────────────────────────

describe('calculateTimeout', () => {
  const chain = makeChain();

  it('calculates correct timeout for L1', () => {
    const result = calculateTimeout(chain, 1, '2026-01-01T00:00:00.000Z');
    expect(result).toBe('2026-01-01T00:01:00.000Z'); // +60s
  });

  it('calculates correct timeout for L2', () => {
    const result = calculateTimeout(chain, 2, '2026-01-01T00:00:00.000Z');
    expect(result).toBe('2026-01-01T00:02:00.000Z'); // +120s
  });

  it('calculates correct timeout for L3', () => {
    const result = calculateTimeout(chain, 3, '2026-01-01T00:00:00.000Z');
    expect(result).toBe('2026-01-01T00:05:00.000Z'); // +300s
  });

  it('throws for non-existent level', () => {
    expect(() => calculateTimeout(chain, 99, '2026-01-01T00:00:00.000Z')).toThrow(
      'Level 99 not found',
    );
  });

  it('throws for invalid timestamp', () => {
    expect(() => calculateTimeout(chain, 1, 'not-a-date')).toThrow('Invalid timestamp');
  });

  it('handles millisecond precision', () => {
    const result = calculateTimeout(chain, 1, '2026-01-01T00:00:00.500Z');
    expect(new Date(result).getTime()).toBe(
      new Date('2026-01-01T00:00:00.500Z').getTime() + 60_000,
    );
  });
});

// ── isTimedOut ───────────────────────────────────────────────────

describe('isTimedOut', () => {
  const item = makePendingItem();

  it('returns true when past timeoutAt', () => {
    expect(isTimedOut(item, '2026-01-02T00:00:00.000Z')).toBe(true);
  });

  it('returns false when before timeoutAt', () => {
    expect(isTimedOut(item, '2026-01-01T00:00:00.001Z')).toBe(false);
  });

  it('returns true when exactly at timeoutAt', () => {
    expect(isTimedOut(item, item.timeoutAt)).toBe(true);
  });
});

// ── remainingTimeMs ─────────────────────────────────────────────

describe('remainingTimeMs', () => {
  const item = makePendingItem();

  it('returns positive value when not timed out', () => {
    const remaining = remainingTimeMs(item, '2026-01-01T00:00:00.001Z');
    expect(remaining).toBeGreaterThan(0);
  });

  it('returns 0 when already timed out', () => {
    expect(remainingTimeMs(item, '2026-01-02T00:00:00.000Z')).toBe(0);
  });

  it('returns 0 when exactly at timeout', () => {
    expect(remainingTimeMs(item, item.timeoutAt)).toBe(0);
  });

  it('returns correct milliseconds', () => {
    // item timeout is 60s from creation
    const remaining = remainingTimeMs(item, '2026-01-01T00:00:30.000Z');
    expect(remaining).toBe(30_000); // 30 seconds remaining
  });
});

// ── resolveChainLevel ───────────────────────────────────────────

describe('resolveChainLevel', () => {
  const chain = makeChain();

  it('resolves existing level', () => {
    const level = resolveChainLevel(chain, 1);
    expect(level).not.toBeNull();
    expect(level!.name).toBe('L1');
  });

  it('returns null for non-existent level', () => {
    expect(resolveChainLevel(chain, 99)).toBeNull();
  });

  it('returns null for level 0', () => {
    expect(resolveChainLevel(chain, 0)).toBeNull();
  });

  it('returns null for negative level', () => {
    expect(resolveChainLevel(chain, -1)).toBeNull();
  });

  it('handles chain with empty levels', () => {
    const empty = makeChain({ levels: [] });
    expect(resolveChainLevel(empty, 1)).toBeNull();
  });
});

// ── getNextChainLevel ───────────────────────────────────────────

describe('getNextChainLevel', () => {
  const chain = makeChain();

  it('returns L2 from L1', () => {
    const next = getNextChainLevel(chain, 1);
    expect(next).not.toBeNull();
    expect(next!.level).toBe(2);
  });

  it('returns L3 from L2', () => {
    const next = getNextChainLevel(chain, 2);
    expect(next).not.toBeNull();
    expect(next!.level).toBe(3);
  });

  it('returns null from last level (L3)', () => {
    expect(getNextChainLevel(chain, 3)).toBeNull();
  });

  it('returns null for non-existent current level', () => {
    expect(getNextChainLevel(chain, 99)).toBeNull();
  });

  it('handles single-level chain', () => {
    const single = makeChain({
      levels: [{ level: 1, name: 'Only', reviewerIds: ['r1'], timeoutMs: 1000 }],
    });
    expect(getNextChainLevel(single, 1)).toBeNull();
  });

  it('handles non-sequential level numbers', () => {
    const nonSeq = makeChain({
      levels: [
        { level: 10, name: 'L10', reviewerIds: ['r1'], timeoutMs: 1000 },
        { level: 20, name: 'L20', reviewerIds: ['r2'], timeoutMs: 2000 },
        { level: 30, name: 'L30', reviewerIds: ['r3'], timeoutMs: 3000 },
      ],
    });
    const next = getNextChainLevel(nonSeq, 10);
    expect(next).not.toBeNull();
    expect(next!.level).toBe(20);
  });
});

// ── isReviewerEligible ──────────────────────────────────────────

describe('isReviewerEligible', () => {
  const chain = makeChain();

  it('returns true for eligible reviewer at L1', () => {
    expect(isReviewerEligible(chain, 1, 'alice')).toBe(true);
    expect(isReviewerEligible(chain, 1, 'bob')).toBe(true);
  });

  it('returns false for ineligible reviewer at L1', () => {
    expect(isReviewerEligible(chain, 1, 'charlie')).toBe(false);
  });

  it('returns true for eligible reviewer at L2', () => {
    expect(isReviewerEligible(chain, 2, 'charlie')).toBe(true);
  });

  it('returns false for non-existent level', () => {
    expect(isReviewerEligible(chain, 99, 'alice')).toBe(false);
  });

  it('returns false for empty reviewer ID', () => {
    expect(isReviewerEligible(chain, 1, '')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isReviewerEligible(chain, 1, 'Alice')).toBe(false);
  });
});

// ── createEscalationItem ────────────────────────────────────────

describe('createEscalationItem', () => {
  it('creates item with correct initial state', () => {
    const item = createEscalationItem({
      reason: 'low_confidence',
      priority: 'high',
      chain: makeChain(),
      context: makeContext(),
      now: '2026-01-01T00:00:00.000Z',
    });

    expect(item.status).toBe('pending');
    expect(item.reason).toBe('low_confidence');
    expect(item.priority).toBe('high');
    expect(item.chainId).toBe('chain-test');
    expect(item.currentLevel).toBe(1);
    expect(item.claimedBy).toBeNull();
    expect(item.claimedAt).toBeNull();
    expect(item.reviewComment).toBeNull();
    expect(item.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(item.updatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('creates item with audit trail entry', () => {
    const item = createEscalationItem({
      reason: 'explicit_request',
      priority: 'medium',
      chain: makeChain(),
      context: makeContext(),
    });

    expect(item.auditTrail).toHaveLength(1);
    expect(item.auditTrail[0]!.action).toBe('created');
    expect(item.auditTrail[0]!.newStatus).toBe('pending');
  });

  it('uses custom start level', () => {
    const item = createEscalationItem({
      reason: 'low_confidence',
      priority: 'critical',
      chain: makeChain(),
      context: makeContext(),
      startLevel: 2,
      now: '2026-01-01T00:00:00.000Z',
    });

    expect(item.currentLevel).toBe(2);
    expect(item.timeoutAt).toBe('2026-01-01T00:02:00.000Z'); // L2 timeout = 120s
  });

  it('defaults to first chain level', () => {
    const item = createEscalationItem({
      reason: 'explicit_request',
      priority: 'low',
      chain: makeChain(),
      context: makeContext(),
    });

    expect(item.currentLevel).toBe(1);
  });

  it('computes timeoutAt correctly', () => {
    const item = createEscalationItem({
      reason: 'explicit_request',
      priority: 'medium',
      chain: makeChain(),
      context: makeContext(),
      now: '2026-01-01T00:00:00.000Z',
    });

    expect(item.timeoutAt).toBe('2026-01-01T00:01:00.000Z'); // L1 = 60s timeout
  });

  it('preserves context data', () => {
    const ctx = makeContext({ agentId: 'special-agent', confidenceScore: 0.42 });
    const item = createEscalationItem({
      reason: 'policy_violation',
      priority: 'critical',
      chain: makeChain(),
      context: ctx,
    });

    expect(item.context.agentId).toBe('special-agent');
    expect(item.context.confidenceScore).toBe(0.42);
  });

  it('generates unique IDs for each item', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const item = createEscalationItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });
      ids.add(item.id);
    }
    expect(ids.size).toBe(100);
  });

  it('handles all reason types', () => {
    const reasons = [
      'low_confidence',
      'explicit_request',
      'policy_violation',
      'timeout',
      'chain_escalation',
    ] as const;

    for (const reason of reasons) {
      const item = createEscalationItem({
        reason,
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });
      expect(item.reason).toBe(reason);
    }
  });

  it('handles all priority types', () => {
    const priorities = ['critical', 'high', 'medium', 'low'] as const;

    for (const priority of priorities) {
      const item = createEscalationItem({
        reason: 'explicit_request',
        priority,
        chain: makeChain(),
        context: makeContext(),
      });
      expect(item.priority).toBe(priority);
    }
  });
});

// ── claimEscalationItem ─────────────────────────────────────────

describe('claimEscalationItem', () => {
  it('transitions pending → claimed', () => {
    const pending = makePendingItem();
    const claimed = claimEscalationItem(pending, 'alice', makeChain());

    expect(claimed.status).toBe('claimed');
    expect(claimed.claimedBy).toBe('alice');
    expect(claimed.claimedAt).toBeTruthy();
  });

  it('is immutable — does not modify original', () => {
    const pending = makePendingItem();
    const claimed = claimEscalationItem(pending, 'alice', makeChain());

    expect(pending.status).toBe('pending');
    expect(pending.claimedBy).toBeNull();
    expect(claimed.status).toBe('claimed');
  });

  it('appends audit entry', () => {
    const pending = makePendingItem();
    const claimed = claimEscalationItem(pending, 'alice', makeChain());

    expect(claimed.auditTrail.length).toBe(pending.auditTrail.length + 1);
    const lastEntry = claimed.auditTrail.at(-1)!;
    expect(lastEntry.action).toBe('claimed');
    expect(lastEntry.actor).toBe('alice');
    expect(lastEntry.previousStatus).toBe('pending');
    expect(lastEntry.newStatus).toBe('claimed');
  });

  it('throws for non-pending status', () => {
    const claimed = makeClaimedItem();
    expect(() => claimEscalationItem(claimed, 'bob', makeChain())).toThrow(
      'Cannot claim item in status "claimed"',
    );
  });

  it('throws for approved item', () => {
    const claimed = makeClaimedItem();
    const approved = approveEscalationItem(claimed, 'alice');
    expect(() => claimEscalationItem(approved, 'bob', makeChain())).toThrow(
      'Cannot claim item in status "approved"',
    );
  });

  it('throws for ineligible reviewer', () => {
    const pending = makePendingItem();
    expect(() => claimEscalationItem(pending, 'unknown-reviewer', makeChain())).toThrow(
      'not eligible',
    );
  });

  it('allows eligible reviewer from L1', () => {
    const pending = makePendingItem();
    // Both alice and bob are in L1
    const claimed = claimEscalationItem(pending, 'bob', makeChain());
    expect(claimed.claimedBy).toBe('bob');
  });

  it('uses provided timestamp', () => {
    const pending = makePendingItem();
    const claimed = claimEscalationItem(pending, 'alice', makeChain(), '2026-06-15T12:00:00.000Z');
    expect(claimed.claimedAt).toBe('2026-06-15T12:00:00.000Z');
    expect(claimed.updatedAt).toBe('2026-06-15T12:00:00.000Z');
  });
});

// ── approveEscalationItem ───────────────────────────────────────

describe('approveEscalationItem', () => {
  it('transitions claimed → approved', () => {
    const claimed = makeClaimedItem();
    const approved = approveEscalationItem(claimed, 'alice', 'Looks good');

    expect(approved.status).toBe('approved');
    expect(approved.reviewComment).toBe('Looks good');
  });

  it('is immutable — does not modify original', () => {
    const claimed = makeClaimedItem();
    approveEscalationItem(claimed, 'alice');
    expect(claimed.status).toBe('claimed');
  });

  it('appends audit entry', () => {
    const claimed = makeClaimedItem();
    const approved = approveEscalationItem(claimed, 'alice', 'LGTM');

    const lastEntry = approved.auditTrail.at(-1)!;
    expect(lastEntry.action).toBe('approved');
    expect(lastEntry.actor).toBe('alice');
    expect(lastEntry.details).toBe('LGTM');
  });

  it('handles no comment', () => {
    const claimed = makeClaimedItem();
    const approved = approveEscalationItem(claimed, 'alice');
    expect(approved.reviewComment).toBeNull();
    expect(approved.auditTrail.at(-1)!.details).toBe('Approved');
  });

  it('throws for non-claimed status', () => {
    const pending = makePendingItem();
    expect(() => approveEscalationItem(pending, 'alice')).toThrow(
      'Cannot approve item in status "pending"',
    );
  });

  it('throws if different reviewer tries to approve', () => {
    const claimed = makeClaimedItem();
    expect(() => approveEscalationItem(claimed, 'bob')).toThrow(
      'cannot approve — item is claimed by "alice"',
    );
  });
});

// ── rejectEscalationItem ────────────────────────────────────────

describe('rejectEscalationItem', () => {
  it('transitions claimed → rejected', () => {
    const claimed = makeClaimedItem();
    const rejected = rejectEscalationItem(claimed, 'alice', 'Too risky');

    expect(rejected.status).toBe('rejected');
    expect(rejected.reviewComment).toBe('Too risky');
  });

  it('is immutable — does not modify original', () => {
    const claimed = makeClaimedItem();
    rejectEscalationItem(claimed, 'alice', 'No');
    expect(claimed.status).toBe('claimed');
  });

  it('appends audit entry', () => {
    const claimed = makeClaimedItem();
    const rejected = rejectEscalationItem(claimed, 'alice', 'Not safe');

    const lastEntry = rejected.auditTrail.at(-1)!;
    expect(lastEntry.action).toBe('rejected');
    expect(lastEntry.actor).toBe('alice');
    expect(lastEntry.details).toBe('Not safe');
  });

  it('handles no comment', () => {
    const claimed = makeClaimedItem();
    const rejected = rejectEscalationItem(claimed, 'alice');
    expect(rejected.reviewComment).toBeNull();
    expect(rejected.auditTrail.at(-1)!.details).toBe('Rejected');
  });

  it('throws for non-claimed status', () => {
    const pending = makePendingItem();
    expect(() => rejectEscalationItem(pending, 'alice')).toThrow(
      'Cannot reject item in status "pending"',
    );
  });

  it('throws if different reviewer tries to reject', () => {
    const claimed = makeClaimedItem();
    expect(() => rejectEscalationItem(claimed, 'charlie')).toThrow(
      'cannot reject — item is claimed by "alice"',
    );
  });
});

// ── autoEscalate ────────────────────────────────────────────────

describe('autoEscalate', () => {
  it('escalates to next level', () => {
    const pending = makePendingItem();
    const escalated = autoEscalate(pending, makeChain(), '2026-01-01T00:05:00.000Z');

    expect(escalated).not.toBeNull();
    expect(escalated!.currentLevel).toBe(2);
    expect(escalated!.status).toBe('pending');
    expect(escalated!.claimedBy).toBeNull();
    expect(escalated!.claimedAt).toBeNull();
  });

  it('returns null when at last level', () => {
    const pending = makePendingItem({ currentLevel: 3 });
    expect(autoEscalate(pending, makeChain())).toBeNull();
  });

  it('recalculates timeoutAt for new level', () => {
    const pending = makePendingItem();
    const escalated = autoEscalate(pending, makeChain(), '2026-01-01T01:00:00.000Z');

    expect(escalated).not.toBeNull();
    // L2 timeout is 120s from now
    expect(escalated!.timeoutAt).toBe('2026-01-01T01:02:00.000Z');
  });

  it('adds 3 audit entries (timed_out, level_changed, pending)', () => {
    const pending = makePendingItem();
    const trailBefore = pending.auditTrail.length;
    const escalated = autoEscalate(pending, makeChain());

    expect(escalated!.auditTrail.length).toBe(trailBefore + 3);
    const newEntries = escalated!.auditTrail.slice(trailBefore);
    expect(newEntries.map((e) => e.action)).toEqual(['timed_out', 'level_changed', 'pending']);
  });

  it('throws for claimed status', () => {
    const claimed = makeClaimedItem();
    expect(() => autoEscalate(claimed, makeChain())).toThrow('Cannot auto-escalate');
  });

  it('throws for approved status', () => {
    const approved = approveEscalationItem(makeClaimedItem(), 'alice');
    expect(() => autoEscalate(approved, makeChain())).toThrow('Cannot auto-escalate');
  });

  it('throws for rejected status', () => {
    const rejected = rejectEscalationItem(makeClaimedItem(), 'alice');
    expect(() => autoEscalate(rejected, makeChain())).toThrow('Cannot auto-escalate');
  });

  it('works for timed_out status (re-escalation)', () => {
    const timedOut = makePendingItem({ status: 'timed_out' });
    const result = autoEscalate(timedOut, makeChain());
    expect(result).not.toBeNull();
    expect(result!.currentLevel).toBe(2);
  });

  it('is immutable', () => {
    const pending = makePendingItem();
    autoEscalate(pending, makeChain());
    expect(pending.currentLevel).toBe(1);
    expect(pending.status).toBe('pending');
  });

  it('handles multi-hop escalation (L1 → L2 → L3)', () => {
    const chain = makeChain();

    const atL1 = makePendingItem();
    const atL2 = autoEscalate(atL1, chain, '2026-01-01T01:00:00.000Z')!;
    expect(atL2.currentLevel).toBe(2);

    const atL3 = autoEscalate(atL2, chain, '2026-01-01T02:00:00.000Z')!;
    expect(atL3.currentLevel).toBe(3);

    const noMore = autoEscalate(atL3, chain, '2026-01-01T03:00:00.000Z');
    expect(noMore).toBeNull();
  });
});

// ── serializeQueueState / deserializeQueueState ─────────────────

describe('serialization', () => {
  describe('serializeQueueState', () => {
    it('creates a valid queue state', () => {
      const items = [makePendingItem()];
      const chains = [makeChain()];
      const thresholds = makeThresholds();

      const state = serializeQueueState(items, chains, thresholds);

      expect(state.version).toBe(1);
      expect(state.items).toHaveLength(1);
      expect(state.chains).toHaveLength(1);
      expect(state.thresholds).toHaveLength(3);
      expect(state.serializedAt).toBeTruthy();
    });

    it('deep-clones items (no shared references)', () => {
      const items = [makePendingItem()];
      const state = serializeQueueState(items, [makeChain()], []);

      items[0] = { ...items[0]!, status: 'approved' } as EscalationItem;
      expect(state.items[0]!.status).toBe('pending'); // unchanged
    });

    it('handles empty arrays', () => {
      const state = serializeQueueState([], [], []);
      expect(state.items).toEqual([]);
      expect(state.chains).toEqual([]);
      expect(state.thresholds).toEqual([]);
    });
  });

  describe('deserializeQueueState', () => {
    it('round-trips through serialize → deserialize', () => {
      const items = [makePendingItem()];
      const chains = [makeChain()];
      const thresholds = makeThresholds();

      const serialized = serializeQueueState(items, chains, thresholds);
      const deserialized = deserializeQueueState(serialized);

      expect(deserialized.items).toHaveLength(1);
      expect(deserialized.items[0]!.id).toBe(items[0]!.id);
      expect(deserialized.chains).toHaveLength(1);
      expect(deserialized.thresholds).toHaveLength(3);
    });

    it('throws for null input', () => {
      expect(() => deserializeQueueState(null)).toThrow('expected an object');
    });

    it('throws for non-object input', () => {
      expect(() => deserializeQueueState('invalid')).toThrow('expected an object');
    });

    it('throws for wrong version', () => {
      expect(() =>
        deserializeQueueState({
          version: 2,
          items: [],
          chains: [],
          thresholds: [],
          serializedAt: 'now',
        }),
      ).toThrow('Unsupported queue state version');
    });

    it('throws for missing items array', () => {
      expect(() =>
        deserializeQueueState({
          version: 1,
          chains: [],
          thresholds: [],
          serializedAt: 'now',
        }),
      ).toThrow('"items" must be an array');
    });

    it('throws for missing chains array', () => {
      expect(() =>
        deserializeQueueState({
          version: 1,
          items: [],
          thresholds: [],
          serializedAt: 'now',
        }),
      ).toThrow('"chains" must be an array');
    });

    it('throws for missing thresholds array', () => {
      expect(() =>
        deserializeQueueState({
          version: 1,
          items: [],
          chains: [],
          serializedAt: 'now',
        }),
      ).toThrow('"thresholds" must be an array');
    });

    it('throws for missing serializedAt', () => {
      expect(() =>
        deserializeQueueState({
          version: 1,
          items: [],
          chains: [],
          thresholds: [],
        }),
      ).toThrow('"serializedAt" must be a string');
    });

    it('throws for item missing required fields', () => {
      expect(() =>
        deserializeQueueState({
          version: 1,
          items: [{ id: 'x' }], // missing status and context
          chains: [],
          thresholds: [],
          serializedAt: 'now',
        }),
      ).toThrow('missing required fields');
    });

    it('accepts valid item with all required fields', () => {
      const item = makePendingItem();
      const state = {
        version: 1,
        items: [item],
        chains: [makeChain()],
        thresholds: makeThresholds(),
        serializedAt: '2026-01-01T00:00:00.000Z',
      };

      const result = deserializeQueueState(state);
      expect(result.items[0]!.id).toBe(item.id);
    });
  });
});

// ── validateContext ──────────────────────────────────────────────

describe('validateContext', () => {
  it('returns empty array for valid context', () => {
    expect(validateContext(makeContext())).toEqual([]);
  });

  it('returns error for null context', () => {
    const errors = validateContext(null);
    expect(errors).toContain('Context must be a non-null object');
  });

  it('returns error for non-object context', () => {
    expect(validateContext('string')).toContain('Context must be a non-null object');
    expect(validateContext(42)).toContain('Context must be a non-null object');
  });

  it('validates agentId is non-empty string', () => {
    const errors = validateContext(makeContext({ agentId: '' }));
    expect(errors.some((e) => e.includes('agentId'))).toBe(true);
  });

  it('validates agentId is present', () => {
    const ctx = { ...makeContext() } as Record<string, unknown>;
    delete ctx.agentId;
    const errors = validateContext(ctx);
    expect(errors.some((e) => e.includes('agentId'))).toBe(true);
  });

  it('validates confidenceScore is finite number', () => {
    const errors = validateContext(makeContext({ confidenceScore: NaN as number }));
    expect(errors.some((e) => e.includes('confidenceScore'))).toBe(true);
  });

  it('validates confidenceScore range 0-1', () => {
    const errors1 = validateContext(makeContext({ confidenceScore: -0.1 }));
    expect(errors1.some((e) => e.includes('between 0 and 1'))).toBe(true);

    const errors2 = validateContext(makeContext({ confidenceScore: 1.5 }));
    expect(errors2.some((e) => e.includes('between 0 and 1'))).toBe(true);
  });

  it('accepts edge confidenceScore values', () => {
    expect(validateContext(makeContext({ confidenceScore: 0 }))).toEqual([]);
    expect(validateContext(makeContext({ confidenceScore: 1 }))).toEqual([]);
  });

  it('validates sourceNodeId is non-empty string', () => {
    const errors = validateContext(makeContext({ sourceNodeId: '' }));
    expect(errors.some((e) => e.includes('sourceNodeId'))).toBe(true);
  });

  it('validates workflowId is non-empty string', () => {
    const errors = validateContext(makeContext({ workflowId: '  ' }));
    expect(errors.some((e) => e.includes('workflowId'))).toBe(true);
  });

  it('validates proposedAction is string', () => {
    const ctx = { ...makeContext() } as Record<string, unknown>;
    ctx.proposedAction = 123;
    const errors = validateContext(ctx);
    expect(errors.some((e) => e.includes('proposedAction'))).toBe(true);
  });

  it('validates reasoning is string', () => {
    const ctx = { ...makeContext() } as Record<string, unknown>;
    ctx.reasoning = null;
    const errors = validateContext(ctx);
    expect(errors.some((e) => e.includes('reasoning'))).toBe(true);
  });

  it('allows empty proposedAction string', () => {
    expect(validateContext(makeContext({ proposedAction: '' }))).toEqual([]);
  });

  it('validates metadata is object if provided', () => {
    const ctx = { ...makeContext() } as Record<string, unknown>;
    ctx.metadata = 'not-an-object';
    const errors = validateContext(ctx);
    expect(errors.some((e) => e.includes('metadata'))).toBe(true);
  });

  it('accepts undefined metadata', () => {
    const ctx = { ...makeContext() } as Record<string, unknown>;
    delete ctx.metadata;
    expect(validateContext(ctx)).toEqual([]);
  });

  it('collects multiple errors at once', () => {
    const errors = validateContext({
      agentId: '',
      confidenceScore: 5,
      sourceNodeId: '',
    });
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});
