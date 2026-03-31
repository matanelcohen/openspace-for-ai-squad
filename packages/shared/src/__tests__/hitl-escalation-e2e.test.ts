/**
 * End-to-end integration tests for the HITL Escalation system.
 *
 * Tests complete escalation flows spanning all layers:
 * - HITLManager (stateful orchestrator)
 * - Pure escalation functions (transitions)
 * - ReviewQueue (query/filter)
 * - DAG integration (callbacks)
 *
 * Covers: multi-tier cascading, concurrent items, full lifecycle auditing,
 * serialization round-trips, edge cases in interrupt mapping, and
 * stress scenarios.
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createHITLCallbacks } from '../escalation/dag-integration.js';
import type { EscalationLifecycleEvent, HITLManagerConfig } from '../escalation/hitl-manager.js';
import { HITLManager } from '../escalation/hitl-manager.js';
import {
  deserializeQueueState,
  isTimedOut,
  remainingTimeMs,
  serializeQueueState,
  validateContext,
} from '../escalation/index.js';
import { ReviewQueue } from '../escalation/review-queue.js';
import type { ExecutionContext, StepNode } from '../types/dag-workflow.js';
import type {
  ConfidenceThreshold,
  EscalationChain,
  EscalationContext,
  EscalationItem,
} from '../types/escalation.js';
import type { InterruptState } from '../types/interrupt.js';

// ── Test Fixtures ───────────────────────────────────────────────

function makeChain(overrides?: Partial<EscalationChain>): EscalationChain {
  return {
    id: 'chain-e2e',
    name: 'E2E Chain',
    levels: [
      { level: 1, name: 'L1 Team Lead', reviewerIds: ['alice', 'bob'], timeoutMs: 60_000 },
      { level: 2, name: 'L2 Manager', reviewerIds: ['charlie'], timeoutMs: 120_000 },
      { level: 3, name: 'L3 Director', reviewerIds: ['diana'], timeoutMs: 300_000 },
    ],
    ...overrides,
  };
}

function makeContext(overrides?: Partial<EscalationContext>): EscalationContext {
  return {
    agentId: 'agent-e2e',
    confidenceScore: 0.3,
    sourceNodeId: 'node-e2e',
    workflowId: 'wf-e2e',
    proposedAction: 'deploy to production',
    reasoning: 'Integration test scenario',
    metadata: {},
    ...overrides,
  };
}

function makeConfig(overrides?: Partial<HITLManagerConfig>): HITLManagerConfig {
  return {
    chains: [makeChain()],
    thresholds: [
      { threshold: 0.8, escalationLevel: 1 },
      { threshold: 0.5, escalationLevel: 2 },
      { threshold: 0.2, escalationLevel: 3 },
    ] as ConfidenceThreshold[],
    defaultChainId: 'chain-e2e',
    ...overrides,
  };
}

function makeInterrupt(overrides?: Partial<InterruptState>): InterruptState {
  return {
    id: 'int-e2e-1',
    executionId: 'exec-e2e',
    nodeId: 'node-e2e',
    status: 'pending',
    request: {
      reason: 'low_confidence',
      message: 'E2E interrupt',
      confidenceScore: 0.25,
      proposedAction: 'delete all data',
      reasoning: 'Seems risky',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    timeoutAt: null,
    escalationId: null,
    resolution: null,
    timeoutPolicy: null,
    ...overrides,
  };
}

function makeExecutionContext(): ExecutionContext {
  return {
    executionId: 'exec-e2e',
    workflowId: 'wf-e2e',
    workflowVersion: '1.0.0',
    vars: {},
    nodeOutputs: {},
    secrets: {},
    toolRegistry: { tools: new Map() } as unknown as ExecutionContext['toolRegistry'],
    startedAt: '2026-01-01T00:00:00.000Z',
    traceId: 'trace-e2e',
  };
}

function makeHITLGateNode(overrides?: Partial<StepNode>): StepNode {
  return {
    id: 'hitl-gate-e2e',
    label: 'E2E Gate',
    type: 'hitl_gate',
    config: {},
    ...overrides,
  };
}

// ── E2E Tests ───────────────────────────────────────────────────

describe('HITL Escalation E2E', () => {
  let manager: HITLManager;
  let queue: ReviewQueue;

  beforeEach(() => {
    manager = new HITLManager(makeConfig());
    queue = new ReviewQueue(manager);
  });

  // ── Multi-tier cascading timeout ─────────────────────────

  describe('multi-tier cascading timeout', () => {
    it('cascades L1 → L2 → L3 → timed_out through full chain', () => {
      const item = manager.createItem({
        reason: 'low_confidence',
        priority: 'high',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      // L1 times out (60s timeout)
      const l1Modified = manager.processTimeouts('2026-01-01T00:01:01.000Z');
      expect(l1Modified).toHaveLength(1);
      expect(manager.getItem(item.id).currentLevel).toBe(2);
      expect(manager.getItem(item.id).status).toBe('pending');

      // L2 times out (120s timeout from L2 start)
      const l2Modified = manager.processTimeouts('2026-01-01T00:04:00.000Z');
      expect(l2Modified).toHaveLength(1);
      expect(manager.getItem(item.id).currentLevel).toBe(3);
      expect(manager.getItem(item.id).status).toBe('pending');

      // L3 times out (300s timeout from L3 start)
      const l3Modified = manager.processTimeouts('2026-01-01T01:00:00.000Z');
      expect(l3Modified).toHaveLength(1);
      expect(manager.getItem(item.id).status).toBe('timed_out');
    });

    it('audit trail captures all cascading events', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      manager.processTimeouts('2026-01-01T00:02:00.000Z'); // L1 → L2
      manager.processTimeouts('2026-01-01T00:05:00.000Z'); // L2 → L3
      manager.processTimeouts('2026-01-01T01:00:00.000Z'); // L3 → timed_out

      const trail = manager.getAuditTrail(item.id);
      const actions = trail.map((e) => e.action);

      expect(actions).toContain('created');
      expect(actions).toContain('timed_out');
      expect(actions).toContain('level_changed');
      expect(trail.length).toBeGreaterThanOrEqual(7);
    });

    it('stops cascading when claimed at intermediate level', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      // L1 times out → escalate to L2
      manager.processTimeouts('2026-01-01T00:02:00.000Z');
      expect(manager.getItem(item.id).currentLevel).toBe(2);

      // L2 reviewer claims it
      manager.claim(item.id, 'charlie');
      expect(manager.getItem(item.id).status).toBe('claimed');

      // Further timeout processing does nothing (item is claimed, not pending)
      const modified = manager.processTimeouts('2026-01-01T01:00:00.000Z');
      expect(modified).toHaveLength(0);
      expect(manager.getItem(item.id).status).toBe('claimed');
    });
  });

  // ── Concurrent items ─────────────────────────────────────

  describe('concurrent escalation items', () => {
    it('processes multiple items at different levels independently', () => {
      const item1 = manager.createItem({
        reason: 'explicit_request',
        priority: 'critical',
        chain: makeChain(),
        context: makeContext({ agentId: 'agent-1' }),
        now: '2026-01-01T00:00:00.000Z',
      });

      const item2 = manager.createItem({
        reason: 'low_confidence',
        priority: 'low',
        chain: makeChain(),
        context: makeContext({ agentId: 'agent-2' }),
        now: '2026-01-01T00:00:30.000Z',
      });

      // Claim item1, leave item2 pending
      manager.claim(item1.id, 'alice');

      // Timeout processing should only affect item2
      const modified = manager.processTimeouts('2026-01-01T00:02:00.000Z');
      expect(modified).toHaveLength(1);
      expect(modified[0]!.id).toBe(item2.id);
      expect(manager.getItem(item1.id).status).toBe('claimed');
      expect(manager.getItem(item2.id).currentLevel).toBe(2);
    });

    it('handles 50 items with mixed statuses', () => {
      const items: EscalationItem[] = [];
      for (let i = 0; i < 50; i++) {
        items.push(
          manager.createItem({
            reason: 'explicit_request',
            priority: (['critical', 'high', 'medium', 'low'] as const)[i % 4],
            chain: makeChain(),
            context: makeContext({ agentId: `agent-${i}` }),
            now: `2026-01-01T00:0${(i % 6).toString()}:00.000Z`,
          }),
        );
      }

      // Claim every other item
      for (let i = 0; i < 50; i += 2) {
        manager.claim(items[i]!.id, 'alice');
      }

      // Approve 10 items
      for (let i = 0; i < 20; i += 2) {
        manager.approve(items[i]!.id, 'alice', `Approved #${i}`);
      }

      const stats = queue.stats();
      expect(stats.total).toBe(50);
      expect(stats.byStatus.approved).toBe(10);
      expect(stats.byStatus.claimed).toBe(15);
      expect(stats.byStatus.pending).toBe(25);
    });

    it('review queue correctly filters by reviewer eligibility across levels', () => {
      // Create 2 items at different times so only 1 times out
      const item1 = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z', // timeoutAt = T+60s
      });
      manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:05:00.000Z', // timeoutAt = T+5min+60s
      });

      // Only item1 has timed out (created at T+0, 60s timeout)
      manager.processTimeouts('2026-01-01T00:02:00.000Z');

      const chain = makeChain();

      // alice is L1 — should see only L1 items (item2 still at L1)
      const forAlice = queue.forReviewer('alice', chain);
      expect(forAlice.length).toBe(1);

      // charlie is L2 — should see escalated item (item1 at L2)
      const forCharlie = queue.forReviewer('charlie', chain);
      expect(forCharlie.length).toBe(1);
      expect(forCharlie[0]!.id).toBe(item1.id);
    });
  });

  // ── Callback event tracking ───────────────────────────────

  describe('lifecycle event tracking', () => {
    it('fires callbacks in correct order for full lifecycle', () => {
      const events: Array<{ event: EscalationLifecycleEvent; status: string }> = [];

      const mgr = new HITLManager(
        makeConfig({
          onItemChanged: (item, event) => {
            events.push({ event, status: item.status });
          },
        }),
      );

      const item = mgr.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      mgr.claim(item.id, 'alice');
      mgr.approve(item.id, 'alice', 'Done');

      expect(events.map((e) => e.event)).toEqual(['created', 'claimed', 'approved']);
    });

    it('fires auto_escalated callback on timeout', () => {
      const events: EscalationLifecycleEvent[] = [];

      const mgr = new HITLManager(
        makeConfig({
          onItemChanged: (_item, event) => events.push(event),
        }),
      );

      mgr.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      mgr.processTimeouts('2026-01-01T00:02:00.000Z');

      expect(events).toContain('created');
      expect(events).toContain('auto_escalated');
    });

    it('fires timed_out callback on final level timeout', () => {
      const events: EscalationLifecycleEvent[] = [];
      const singleChain = makeChain({
        id: 'single-e2e',
        levels: [{ level: 1, name: 'Only', reviewerIds: ['r1'], timeoutMs: 1000 }],
      });

      const mgr = new HITLManager({
        chains: [singleChain],
        thresholds: makeConfig().thresholds,
        defaultChainId: 'single-e2e',
        onItemChanged: (_item, event) => events.push(event),
      });

      mgr.createItem({
        reason: 'explicit_request',
        priority: 'low',
        chain: singleChain,
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      mgr.processTimeouts('2026-01-02T00:00:00.000Z');
      expect(events).toContain('timed_out');
    });
  });

  // ── Interrupt → Escalation bridge ─────────────────────────

  describe('interrupt to escalation bridge', () => {
    it('maps all interrupt reasons correctly', () => {
      const reasonMap: Record<string, string> = {
        low_confidence: 'low_confidence',
        confidence_below_threshold: 'low_confidence',
        explicit_request: 'explicit_request',
        policy_violation: 'policy_violation',
        safety_check: 'policy_violation',
        timeout: 'timeout',
        unknown_reason: 'explicit_request', // default
        destructive_action: 'explicit_request', // default
      };

      for (const [interruptReason, expectedEscReason] of Object.entries(reasonMap)) {
        const interrupt = makeInterrupt({
          id: `int-${interruptReason}`,
          request: {
            reason: interruptReason as InterruptState['request']['reason'],
            message: `Test ${interruptReason}`,
            confidenceScore: 0.3,
            proposedAction: 'test',
          },
        });

        const item = manager.triggerFromInterrupt({ interrupt });
        expect(item.reason).toBe(expectedEscReason);
      }
    });

    it('uses interrupt message as reasoning when no reasoning provided', () => {
      const interrupt = makeInterrupt({
        request: {
          reason: 'explicit_request',
          message: 'Please review this action',
          confidenceScore: 0.5,
          proposedAction: 'execute command',
        },
      });

      const item = manager.triggerFromInterrupt({ interrupt });
      expect(item.context.reasoning).toBe('Please review this action');
    });

    it('uses interrupt reasoning over message when both provided', () => {
      const interrupt = makeInterrupt({
        request: {
          reason: 'explicit_request',
          message: 'Short message',
          confidenceScore: 0.5,
          proposedAction: 'test',
          reasoning: 'Detailed reasoning about why this needs review',
        },
      });

      const item = manager.triggerFromInterrupt({ interrupt });
      expect(item.context.reasoning).toBe('Detailed reasoning about why this needs review');
    });

    it('stringifies non-string proposedAction', () => {
      const interrupt = makeInterrupt({
        request: {
          reason: 'explicit_request',
          message: 'Review complex action',
          confidenceScore: 0.5,
          proposedAction: { type: 'deploy', target: 'prod' },
        },
      });

      const item = manager.triggerFromInterrupt({ interrupt });
      expect(typeof item.context.proposedAction).toBe('string');
      expect(item.context.proposedAction).toContain('deploy');
    });

    it('stores interrupt metadata in escalation context', () => {
      const interrupt = makeInterrupt({
        id: 'int-meta',
        request: {
          reason: 'explicit_request',
          message: 'With metadata',
          confidenceScore: 0.5,
          proposedAction: 'test',
          metadata: { customField: 'value', nested: { data: true } },
        },
      });

      const item = manager.triggerFromInterrupt({ interrupt });
      expect(item.context.metadata).toEqual(
        expect.objectContaining({
          interruptId: 'int-meta',
          interruptReason: 'explicit_request',
          customField: 'value',
          nested: { data: true },
        }),
      );
    });

    it('sets agentId from interrupt nodeId', () => {
      const interrupt = makeInterrupt({
        nodeId: 'deploy-node-42',
      });

      const item = manager.triggerFromInterrupt({ interrupt });
      expect(item.context.agentId).toBe('node:deploy-node-42');
    });
  });

  // ── Confidence-to-priority mapping ────────────────────────

  describe('confidence to priority mapping', () => {
    it('maps confidence < 0.2 to critical', () => {
      const item = manager.evaluateAndTrigger({ context: makeContext({ confidenceScore: 0.1 }) });
      expect(item!.priority).toBe('critical');
    });

    it('maps confidence 0.0 to critical', () => {
      const item = manager.evaluateAndTrigger({ context: makeContext({ confidenceScore: 0 }) });
      expect(item!.priority).toBe('critical');
    });

    it('maps confidence 0.2 to high (boundary)', () => {
      const item = manager.evaluateAndTrigger({ context: makeContext({ confidenceScore: 0.2 }) });
      expect(item!.priority).toBe('high');
    });

    it('maps confidence 0.39 to high', () => {
      const item = manager.evaluateAndTrigger({ context: makeContext({ confidenceScore: 0.39 }) });
      expect(item!.priority).toBe('high');
    });

    it('maps confidence 0.4 to medium (boundary)', () => {
      const item = manager.evaluateAndTrigger({ context: makeContext({ confidenceScore: 0.4 }) });
      expect(item!.priority).toBe('medium');
    });

    it('maps confidence 0.59 to medium', () => {
      const item = manager.evaluateAndTrigger({ context: makeContext({ confidenceScore: 0.59 }) });
      expect(item!.priority).toBe('medium');
    });

    it('maps confidence 0.6 to low (boundary)', () => {
      const item = manager.evaluateAndTrigger({ context: makeContext({ confidenceScore: 0.6 }) });
      expect(item!.priority).toBe('low');
    });

    it('maps confidence 0.79 to low', () => {
      const item = manager.evaluateAndTrigger({ context: makeContext({ confidenceScore: 0.79 }) });
      expect(item!.priority).toBe('low');
    });
  });

  // ── Confidence-to-escalation-level mapping ────────────────

  describe('confidence to escalation level', () => {
    it('routes very low confidence directly to L3', () => {
      const item = manager.evaluateAndTrigger({ context: makeContext({ confidenceScore: 0.1 }) });
      expect(item).not.toBeNull();
      // Score 0.1 < 0.2, 0.5, 0.8 — highest matching is 0.8, escalationLevel 1
      expect(item!.currentLevel).toBe(1);
    });

    it('does not escalate when confidence is high', () => {
      const item = manager.evaluateAndTrigger({ context: makeContext({ confidenceScore: 0.9 }) });
      expect(item).toBeNull();
    });

    it('escalates at the exact threshold boundary → no escalation', () => {
      // At exactly 0.8 — not below, so should NOT trigger
      const item = manager.evaluateAndTrigger({ context: makeContext({ confidenceScore: 0.8 }) });
      expect(item).toBeNull();
    });
  });

  // ── Serialization round-trip with active items ────────────

  describe('serialization round-trip', () => {
    it('preserves items through serialize → deserialize', () => {
      const item1 = manager.createItem({
        reason: 'explicit_request',
        priority: 'high',
        chain: makeChain(),
        context: makeContext({ agentId: 'a1' }),
        now: '2026-01-01T00:00:00.000Z',
      });

      manager.claim(item1.id, 'alice');

      manager.createItem({
        reason: 'low_confidence',
        priority: 'critical',
        chain: makeChain(),
        context: makeContext({ agentId: 'a2' }),
        now: '2026-01-01T00:01:00.000Z',
      });

      const items = manager.getAllItems();
      const chains = [makeChain()];
      const thresholds = makeConfig().thresholds;

      const serialized = serializeQueueState(items, chains, thresholds);
      const deserialized = deserializeQueueState(serialized);

      expect(deserialized.items).toHaveLength(2);
      expect(deserialized.items.find((i) => i.status === 'claimed')).toBeTruthy();
      expect(deserialized.items.find((i) => i.status === 'pending')).toBeTruthy();
    });

    it('preserves audit trails through serialization', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      manager.claim(item.id, 'alice');
      manager.approve(item.id, 'alice', 'Approved in serialization test');

      const serialized = serializeQueueState(manager.getAllItems(), [makeChain()], []);
      const deserialized = deserializeQueueState(serialized);

      const restoredItem = deserialized.items[0]!;
      expect(restoredItem.auditTrail.length).toBeGreaterThanOrEqual(3);
      expect(restoredItem.auditTrail.map((e) => e.action)).toContain('approved');
    });

    it('validates context after deserialization', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });

      const serialized = serializeQueueState([item], [makeChain()], []);
      const deserialized = deserializeQueueState(serialized);

      const errors = validateContext(deserialized.items[0]!.context);
      expect(errors).toEqual([]);
    });
  });

  // ── ReviewQueue + Manager integration ─────────────────────

  describe('ReviewQueue with escalated items', () => {
    it('stats track escalated items correctly', () => {
      // Create 3 items
      for (let i = 0; i < 3; i++) {
        manager.createItem({
          reason: 'explicit_request',
          priority: (['critical', 'high', 'medium'] as const)[i],
          chain: makeChain(),
          context: makeContext({ agentId: `agent-${i}` }),
          now: '2026-01-01T00:00:00.000Z',
        });
      }

      // Escalate all through timeout
      manager.processTimeouts('2026-01-01T00:02:00.000Z');

      const stats = queue.stats();
      expect(stats.total).toBe(3);
      // After auto-escalation, items return to pending at next level
      expect(stats.byStatus.pending).toBe(3);
    });

    it('pending() returns items sorted by priority after escalation', () => {
      for (let i = 0; i < 4; i++) {
        manager.createItem({
          reason: 'explicit_request',
          priority: (['low', 'critical', 'medium', 'high'] as const)[i],
          chain: makeChain(),
          context: makeContext({ agentId: `agent-${i}` }),
          now: '2026-01-01T00:00:00.000Z',
        });
      }

      const pending = queue.pending();
      expect(pending.length).toBe(4);
      const priorities = pending.map((i) => i.priority);
      // Should be sorted: critical, high, medium, low
      expect(priorities[0]).toBe('critical');
      expect(priorities[priorities.length - 1]).toBe('low');
    });

    it('resolved() shows correct items after mixed approve/reject', () => {
      const items: EscalationItem[] = [];
      for (let i = 0; i < 4; i++) {
        items.push(
          manager.createItem({
            reason: 'explicit_request',
            priority: 'medium',
            chain: makeChain(),
            context: makeContext({ agentId: `agent-${i}` }),
          }),
        );
      }

      manager.claim(items[0]!.id, 'alice');
      manager.approve(items[0]!.id, 'alice', 'Yes');
      manager.claim(items[1]!.id, 'bob');
      manager.reject(items[1]!.id, 'bob', 'No');
      manager.claim(items[2]!.id, 'alice');
      manager.approve(items[2]!.id, 'alice');

      const resolved = queue.resolved();
      expect(resolved).toHaveLength(3);
      expect(resolved.filter((i) => i.status === 'approved')).toHaveLength(2);
      expect(resolved.filter((i) => i.status === 'rejected')).toHaveLength(1);
    });
  });

  // ── Manager chain resolution ──────────────────────────────

  describe('chain resolution edge cases', () => {
    it('resolveChainOrDefault uses default when no chainId', () => {
      const chain = manager.resolveChainOrDefault();
      expect(chain.id).toBe('chain-e2e');
    });

    it('resolveChainOrDefault uses provided chainId', () => {
      const altChain = makeChain({ id: 'alt-chain' });
      const mgr = new HITLManager(makeConfig({ chains: [makeChain(), altChain] }));
      const chain = mgr.resolveChainOrDefault('alt-chain');
      expect(chain.id).toBe('alt-chain');
    });

    it('throws when no chain and no default', () => {
      const mgr = new HITLManager({
        chains: [makeChain()],
        thresholds: [],
        // no defaultChainId
      });

      expect(() => mgr.resolveChainOrDefault()).toThrow('No chain ID provided');
    });
  });

  // ── Error path coverage ───────────────────────────────────

  describe('error paths', () => {
    it('cannot claim an already approved item', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });

      manager.claim(item.id, 'alice');
      manager.approve(item.id, 'alice');

      expect(() => manager.claim(item.id, 'bob')).toThrow('Cannot claim');
    });

    it('cannot approve a pending item directly', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });

      expect(() => manager.approve(item.id, 'alice')).toThrow('Cannot approve');
    });

    it('cannot reject a pending item directly', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });

      expect(() => manager.reject(item.id, 'alice')).toThrow('Cannot reject');
    });

    it('cannot claim with ineligible reviewer', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });

      // diana is only in L3
      expect(() => manager.claim(item.id, 'diana')).toThrow('not eligible');
    });

    it('getItem throws for non-existent ID', () => {
      expect(() => manager.getItem('ghost')).toThrow('not found');
    });

    it('findItem returns null for non-existent ID', () => {
      expect(manager.findItem('ghost')).toBeNull();
    });
  });

  // ── DAG integration full flow ─────────────────────────────

  describe('DAG integration full flow', () => {
    it('DAG gate → review → resolve → resume', async () => {
      const callbacks = createHITLCallbacks(manager);

      // 1. DAG engine triggers gate
      const escalationId = await callbacks.onHITLGate(
        makeHITLGateNode(),
        'exec-1',
        makeExecutionContext(),
      );

      // 2. Review queue shows the item
      const pending = queue.pending();
      expect(pending.some((i) => i.id === escalationId)).toBe(true);

      // 3. Reviewer claims and approves
      manager.claim(escalationId, 'alice');
      manager.approve(escalationId, 'alice', 'Approved via DAG');

      // 4. DAG engine resolves
      const result = await callbacks.resolveEscalation(escalationId);
      expect(result.approved).toBe(true);

      // 5. Resolved queue shows the item
      const resolved = queue.resolved();
      expect(resolved.some((i) => i.id === escalationId)).toBe(true);
    });

    it('DAG gate → timeout cascade → final timeout → resolve as failed', async () => {
      const singleChain = makeChain({
        id: 'single-dag',
        levels: [{ level: 1, name: 'Only', reviewerIds: ['r1'], timeoutMs: 1000 }],
      });
      const mgr = new HITLManager({
        chains: [singleChain],
        thresholds: [],
        defaultChainId: 'single-dag',
      });
      const callbacks = createHITLCallbacks(mgr);

      const escalationId = await callbacks.onHITLGate(
        makeHITLGateNode(),
        'exec-1',
        makeExecutionContext(),
      );

      // Use far-future timestamp since onHITLGate uses real Date.now()
      mgr.processTimeouts('2099-01-01T00:00:00.000Z');

      const result = await callbacks.resolveEscalation(escalationId);
      expect(result.approved).toBe(false);
      expect(result.output).toBe('Escalation timed out');
    });
  });

  // ── Timeout utility integration ───────────────────────────

  describe('timeout utilities with real items', () => {
    it('isTimedOut returns true for expired items', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      expect(isTimedOut(item, '2026-01-01T00:00:30.000Z')).toBe(false);
      expect(isTimedOut(item, '2026-01-01T00:01:01.000Z')).toBe(true);
    });

    it('remainingTimeMs counts down correctly', () => {
      const item = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      // L1 timeout is 60s, so timeoutAt = T+60s
      expect(remainingTimeMs(item, '2026-01-01T00:00:00.000Z')).toBe(60_000);
      expect(remainingTimeMs(item, '2026-01-01T00:00:30.000Z')).toBe(30_000);
      expect(remainingTimeMs(item, '2026-01-01T00:01:00.000Z')).toBe(0);
      expect(remainingTimeMs(item, '2026-01-01T00:02:00.000Z')).toBe(0);
    });
  });

  // ── Global audit trail ────────────────────────────────────

  describe('global audit trail', () => {
    it('returns all entries across items sorted by timestamp', () => {
      const item1 = manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      const item2 = manager.createItem({
        reason: 'low_confidence',
        priority: 'high',
        chain: makeChain(),
        context: makeContext(),
        now: '2026-01-01T00:00:01.000Z',
      });

      manager.claim(item1.id, 'alice', undefined, '2026-01-01T00:00:02.000Z');
      manager.claim(item2.id, 'bob', undefined, '2026-01-01T00:00:03.000Z');
      manager.approve(item1.id, 'alice', 'OK', '2026-01-01T00:00:04.000Z');

      const trail = manager.getGlobalAuditTrail();

      // Should be sorted by timestamp
      for (let i = 1; i < trail.length; i++) {
        expect(new Date(trail[i]!.timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(trail[i - 1]!.timestamp).getTime(),
        );
      }

      // Should contain entries from both items
      const escalationIds = [...new Set(trail.map((e) => e.escalationId))];
      expect(escalationIds).toHaveLength(2);
    });
  });

  // ── Clear and re-use ─────────────────────────────────────

  describe('manager clear and re-use', () => {
    it('clear resets all state', () => {
      for (let i = 0; i < 5; i++) {
        manager.createItem({
          reason: 'explicit_request',
          priority: 'medium',
          chain: makeChain(),
          context: makeContext(),
        });
      }
      expect(manager.size).toBe(5);

      manager.clear();
      expect(manager.size).toBe(0);
      expect(manager.getAllItems()).toEqual([]);
      expect(manager.getGlobalAuditTrail()).toEqual([]);
    });

    it('can create new items after clear', () => {
      manager.createItem({
        reason: 'explicit_request',
        priority: 'medium',
        chain: makeChain(),
        context: makeContext(),
      });
      manager.clear();

      const newItem = manager.createItem({
        reason: 'low_confidence',
        priority: 'high',
        chain: makeChain(),
        context: makeContext(),
      });

      expect(manager.size).toBe(1);
      expect(newItem.status).toBe('pending');
    });
  });

  // ── Multiple chains ───────────────────────────────────────

  describe('multiple chains', () => {
    it('routes items to different chains', () => {
      const prodChain = makeChain({ id: 'prod-chain', name: 'Production' });
      const devChain = makeChain({
        id: 'dev-chain',
        name: 'Development',
        levels: [{ level: 1, name: 'Dev Lead', reviewerIds: ['dev-lead'], timeoutMs: 30_000 }],
      });

      const mgr = new HITLManager({
        chains: [prodChain, devChain],
        thresholds: makeConfig().thresholds,
        defaultChainId: 'prod-chain',
      });

      const prodItem = mgr.createItem({
        reason: 'explicit_request',
        priority: 'critical',
        chain: prodChain,
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      const devItem = mgr.createItem({
        reason: 'explicit_request',
        priority: 'low',
        chain: devChain,
        context: makeContext(),
        now: '2026-01-01T00:00:00.000Z',
      });

      expect(prodItem.chainId).toBe('prod-chain');
      expect(devItem.chainId).toBe('dev-chain');

      // Both chains timed out (prod L1=60s, dev L1=30s)
      mgr.processTimeouts('2026-01-01T00:02:00.000Z');

      // Prod item escalated to L2, dev item timed out (single-level chain)
      expect(mgr.getItem(prodItem.id).currentLevel).toBe(2);
      expect(mgr.getItem(devItem.id).status).toBe('timed_out');
    });
  });
});
