import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { EscalationLifecycleEvent, HITLManagerConfig } from '../escalation/hitl-manager.js';
import { HITLManager } from '../escalation/hitl-manager.js';
import type {
  ConfidenceThreshold,
  EscalationChain,
  EscalationContext,
} from '../types/escalation.js';
import type { InterruptState } from '../types/interrupt.js';

// ── Test Fixtures ───────────────────────────────────────────────

function makeChain(overrides?: Partial<EscalationChain>): EscalationChain {
  return {
    id: 'chain-default',
    name: 'Default Chain',
    levels: [
      {
        level: 1,
        name: 'L1 Reviewer',
        reviewerIds: ['reviewer-1', 'reviewer-2'],
        timeoutMs: 60_000,
      },
      { level: 2, name: 'L2 Senior', reviewerIds: ['senior-1'], timeoutMs: 120_000 },
      { level: 3, name: 'L3 Admin', reviewerIds: ['admin-1'], timeoutMs: 300_000 },
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
  ];
}

function makeConfig(overrides?: Partial<HITLManagerConfig>): HITLManagerConfig {
  return {
    chains: [makeChain()],
    thresholds: makeThresholds(),
    defaultChainId: 'chain-default',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('HITLManager', () => {
  let manager: HITLManager;

  beforeEach(() => {
    manager = new HITLManager(makeConfig());
  });

  // ── Construction & Chain Resolution ──────────────────────

  describe('construction', () => {
    it('starts with zero items', () => {
      expect(manager.size).toBe(0);
      expect(manager.getAllItems()).toEqual([]);
    });

    it('resolves chain by ID', () => {
      const chain = manager.getChain('chain-default');
      expect(chain.name).toBe('Default Chain');
    });

    it('throws for unknown chain ID', () => {
      expect(() => manager.getChain('nonexistent')).toThrow('not found');
    });
  });

  // ── createItem ───────────────────────────────────────────

  describe('createItem', () => {
    it('creates and stores an escalation item', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });

      expect(item.id).toBeTruthy();
      expect(item.status).toBe('pending');
      expect(item.priority).toBe('medium');
      expect(item.reason).toBe('explicit_request');
      expect(manager.size).toBe(1);
    });

    it('fires onItemChanged callback with created event', () => {
      const callback = vi.fn();
      const mgr = new HITLManager(makeConfig({ onItemChanged: callback }));

      mgr.createItem({
        reason: 'explicit_request',
        priority: 'high',
        chain: makeChain(),
        context: makeContext(),
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'pending' }),
        'created',
      );
    });

    it('creates items with audit trail', () => {
      const item = manager.createItem({
        reason: 'low_confidence',
        priority: 'critical',
        chain: makeChain(),
        context: makeContext(),
      });

      expect(item.auditTrail.length).toBeGreaterThan(0);
      expect(item.auditTrail[0]!.action).toBe('created');
    });
  });

  // ── evaluateAndTrigger ───────────────────────────────────

  describe('evaluateAndTrigger', () => {
    it('triggers escalation for low confidence', () => {
      const item = manager.evaluateAndTrigger({
        context: makeContext({ confidenceScore: 0.2 }),
      });

      expect(item).not.toBeNull();
      expect(item!.status).toBe('pending');
      expect(item!.reason).toBe('low_confidence');
    });

    it('returns null when confidence is above all thresholds', () => {
      const item = manager.evaluateAndTrigger({
        context: makeContext({ confidenceScore: 0.9 }),
      });

      expect(item).toBeNull();
    });

    it('maps low confidence to critical priority', () => {
      const item = manager.evaluateAndTrigger({
        context: makeContext({ confidenceScore: 0.1 }),
      });
      expect(item!.priority).toBe('critical');
    });

    it('maps moderate-low confidence to high priority', () => {
      const item = manager.evaluateAndTrigger({
        context: makeContext({ confidenceScore: 0.3 }),
      });
      expect(item!.priority).toBe('high');
    });

    it('maps medium confidence to medium priority', () => {
      const item = manager.evaluateAndTrigger({
        context: makeContext({ confidenceScore: 0.5 }),
      });
      expect(item!.priority).toBe('medium');
    });

    it('respects agent role filtering on thresholds', () => {
      const mgr = new HITLManager(
        makeConfig({
          thresholds: [{ threshold: 0.8, escalationLevel: 1, agentRoles: ['tester'] }],
        }),
      );

      // Should trigger for matching role
      const item1 = mgr.evaluateAndTrigger({
        context: makeContext({ confidenceScore: 0.5 }),
        agentRole: 'tester',
      });
      expect(item1).not.toBeNull();

      // Should NOT trigger for different role
      const item2 = mgr.evaluateAndTrigger({
        context: makeContext({ confidenceScore: 0.5 }),
        agentRole: 'developer',
      });
      expect(item2).toBeNull();
    });
  });

  // ── Claim/Approve/Reject lifecycle ───────────────────────

  describe('lifecycle transitions', () => {
    let itemId: string;

    beforeEach(() => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });
      itemId = item.id;
    });

    it('claims a pending item', () => {
      const claimed = manager.claim(itemId, 'reviewer-1');
      expect(claimed.status).toBe('claimed');
      expect(claimed.claimedBy).toBe('reviewer-1');
    });

    it('approves an item', () => {
      manager.claim(itemId, 'reviewer-1');
      const approved = manager.approve(itemId, 'reviewer-1', 'LGTM');
      expect(approved.status).toBe('approved');
      expect(approved.reviewComment).toBe('LGTM');
    });

    it('rejects an item', () => {
      manager.claim(itemId, 'reviewer-1');
      const rejected = manager.reject(itemId, 'reviewer-1', 'Too risky');
      expect(rejected.status).toBe('rejected');
      expect(rejected.reviewComment).toBe('Too risky');
    });

    it('fires callbacks for each transition', () => {
      const events: EscalationLifecycleEvent[] = [];
      const mgr = new HITLManager(
        makeConfig({
          onItemChanged: (_item, event) => events.push(event),
        }),
      );

      const item = mgr.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });

      mgr.claim(item.id, 'reviewer-1');
      mgr.approve(item.id, 'reviewer-1');

      expect(events).toEqual(['created', 'claimed', 'approved']);
    });

    it('builds audit trail across transitions', () => {
      manager.claim(itemId, 'reviewer-1');
      manager.approve(itemId, 'reviewer-1', 'approved');

      const trail = manager.getAuditTrail(itemId);
      expect(trail.length).toBeGreaterThanOrEqual(3);
      expect(trail.map((e) => e.action)).toContain('created');
      expect(trail.map((e) => e.action)).toContain('claimed');
      expect(trail.map((e) => e.action)).toContain('approved');
    });
  });

  // ── Timeout Processing ───────────────────────────────────

  describe('processTimeouts', () => {
    it('auto-escalates timed-out pending items', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      // Process at a time far after the timeout
      const modified = manager.processTimeouts('2026-01-02T00:00:00.000Z');
      expect(modified.length).toBe(1);

      const updated = manager.getItem(item.id);
      expect(updated.status === 'auto_escalated' || updated.currentLevel > item.currentLevel).toBe(
        true,
      );
    });

    it('marks as timed_out when no more levels', () => {
      const singleLevelChain = makeChain({
        id: 'single',
        levels: [{ level: 1, name: 'Only', reviewerIds: ['r1'], timeoutMs: 1000 }],
      });

      const mgr = new HITLManager(
        makeConfig({
          chains: [singleLevelChain],
          defaultChainId: 'single',
        }),
      );

      mgr.createItem({
        reason: 'explicit_request',
        priority: 'low',
        chain: singleLevelChain,
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      const modified = mgr.processTimeouts('2026-01-02T00:00:00.000Z');
      expect(modified.length).toBe(1);
      expect(modified[0]!.status).toBe('timed_out');
    });

    it('does not modify items that have not timed out', () => {
      manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      // Process immediately — no timeout yet
      const modified = manager.processTimeouts('2026-01-01T00:00:00.001Z');
      expect(modified.length).toBe(0);
    });

    it('skips non-pending items', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      manager.claim(item.id, 'reviewer-1');

      const modified = manager.processTimeouts('2026-01-02T00:00:00.000Z');
      expect(modified.length).toBe(0);
    });
  });

  // ── triggerFromInterrupt ─────────────────────────────────

  describe('triggerFromInterrupt', () => {
    it('creates escalation from interrupt state', () => {
      const interrupt: InterruptState = {
        id: 'int-1',
        executionId: 'exec-1',
        nodeId: 'node-1',
        status: 'pending',
        request: {
          reason: 'low_confidence',
          message: 'Not sure about this action',
          confidenceScore: 0.3,
          proposedAction: 'delete file',
          reasoning: 'File looks important',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        timeoutAt: null,
        escalationId: null,
        resolution: null,
        timeoutPolicy: null,
      };

      const item = manager.triggerFromInterrupt({ interrupt });
      expect(item.status).toBe('pending');
      expect(item.reason).toBe('low_confidence');
      expect(item.context.agentId).toBe('node:node-1');
    });

    it('maps policy_violation interrupt reason', () => {
      const interrupt: InterruptState = {
        id: 'int-2',
        executionId: 'exec-1',
        nodeId: 'node-2',
        status: 'pending',
        request: {
          reason: 'policy_violation',
          message: 'Restricted action',
          confidenceScore: 0.1,
          proposedAction: 'sudo rm -rf /',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        timeoutAt: null,
        escalationId: null,
        resolution: null,
        timeoutPolicy: null,
      };

      const item = manager.triggerFromInterrupt({ interrupt });
      expect(item.reason).toBe('policy_violation');
    });

    it('uses default priority when none specified', () => {
      const interrupt: InterruptState = {
        id: 'int-3',
        executionId: 'exec-1',
        nodeId: 'node-3',
        status: 'pending',
        request: {
          reason: 'explicit_request',
          message: 'Needs approval',
          confidenceScore: 0.5,
          proposedAction: 'proceed',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        timeoutAt: null,
        escalationId: null,
        resolution: null,
        timeoutPolicy: null,
      };

      const item = manager.triggerFromInterrupt({ interrupt });
      expect(item.priority).toBe('medium');
    });

    it('uses custom priority when specified', () => {
      const interrupt: InterruptState = {
        id: 'int-4',
        executionId: 'exec-1',
        nodeId: 'node-4',
        status: 'pending',
        request: {
          reason: 'explicit_request',
          message: 'Critical approval',
          confidenceScore: 0.1,
          proposedAction: 'deploy',
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        timeoutAt: null,
        escalationId: null,
        resolution: null,
        timeoutPolicy: null,
      };

      const item = manager.triggerFromInterrupt({ interrupt, priority: 'critical' });
      expect(item.priority).toBe('critical');
    });
  });

  // ── Query Methods ────────────────────────────────────────

  describe('queries', () => {
    it('getItem throws for missing ID', () => {
      expect(() => manager.getItem('nonexistent')).toThrow('not found');
    });

    it('findItem returns null for missing ID', () => {
      expect(manager.findItem('nonexistent')).toBeNull();
    });

    it('getItemsByStatus filters correctly', () => {
      const item1 = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });
      manager.createItem({
        reason: 'explicit_request',
        priority: 'high',
        chain: makeChain(),
        context: makeContext(),
      });

      manager.claim(item1.id, 'reviewer-1');

      const pending = manager.getItemsByStatus('pending');
      expect(pending.length).toBe(1);

      const claimed = manager.getItemsByStatus('claimed');
      expect(claimed.length).toBe(1);

      const both = manager.getItemsByStatus('pending', 'claimed');
      expect(both.length).toBe(2);
    });

    it('getGlobalAuditTrail returns sorted entries', () => {
      manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });
      manager.createItem({
        reason: 'explicit_request',
        priority: 'high',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:01.000Z',
      });

      const trail = manager.getGlobalAuditTrail();
      expect(trail.length).toBeGreaterThanOrEqual(2);

      // Verify sorted ascending by timestamp
      for (let i = 1; i < trail.length; i++) {
        expect(new Date(trail[i]!.timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(trail[i - 1]!.timestamp).getTime(),
        );
      }
    });

    it('clear removes all items', () => {
      manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });
      expect(manager.size).toBe(1);

      manager.clear();
      expect(manager.size).toBe(0);
      expect(manager.getAllItems()).toEqual([]);
    });
  });
});
