/**
 * Tests for DAG Integration — createHITLCallbacks factory and its callbacks.
 *
 * Covers: onHITLGate callback (escalation item creation from DAG nodes),
 * resolveEscalation callback (status-based resolution), and all configuration
 * options (default priority, reason, chain, confidence).
 */

import { beforeEach, describe, expect, it } from 'vitest';

import { createHITLCallbacks } from '../escalation/dag-integration.js';
import { HITLManager } from '../escalation/hitl-manager.js';
import type { ExecutionContext, StepNode } from '../types/dag-workflow.js';
import type { ConfidenceThreshold, EscalationChain } from '../types/escalation.js';

// ── Test Fixtures ───────────────────────────────────────────────

function makeChain(overrides?: Partial<EscalationChain>): EscalationChain {
  return {
    id: 'chain-dag',
    name: 'DAG Chain',
    levels: [
      { level: 1, name: 'L1', reviewerIds: ['alice', 'bob'], timeoutMs: 60_000 },
      { level: 2, name: 'L2', reviewerIds: ['charlie'], timeoutMs: 120_000 },
    ],
    ...overrides,
  };
}

function makeThresholds(): ConfidenceThreshold[] {
  return [{ threshold: 0.7, escalationLevel: 1 }];
}

function makeManager(chainOverrides?: Partial<EscalationChain>): HITLManager {
  const chain = makeChain(chainOverrides);
  return new HITLManager({
    chains: [chain],
    thresholds: makeThresholds(),
    defaultChainId: chain.id,
  });
}

function makeHITLGateNode(overrides?: Partial<StepNode>): StepNode {
  return {
    id: 'hitl-gate-1',
    label: 'Deployment Approval',
    type: 'hitl_gate',
    config: {},
    ...overrides,
  };
}

function makeExecutionContext(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-dag-1',
    workflowVersion: '1.0.0',
    vars: {},
    nodeOutputs: {},
    secrets: {},
    toolRegistry: { tools: new Map() } as unknown as ExecutionContext['toolRegistry'],
    startedAt: '2026-01-01T00:00:00.000Z',
    traceId: 'trace-dag-1',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('createHITLCallbacks', () => {
  let manager: HITLManager;

  beforeEach(() => {
    manager = makeManager();
  });

  // ── Factory creation ─────────────────────────────────────

  describe('factory', () => {
    it('returns object with onHITLGate and resolveEscalation', () => {
      const callbacks = createHITLCallbacks(manager);
      expect(callbacks.onHITLGate).toBeTypeOf('function');
      expect(callbacks.resolveEscalation).toBeTypeOf('function');
    });

    it('creates callbacks with default options', () => {
      const callbacks = createHITLCallbacks(manager);
      expect(callbacks).toBeDefined();
    });

    it('accepts custom options', () => {
      const callbacks = createHITLCallbacks(manager, {
        defaultPriority: 'critical',
        defaultReason: 'policy_violation',
        defaultConfidence: 0.3,
      });
      expect(callbacks).toBeDefined();
    });
  });

  // ── onHITLGate ────────────────────────────────────────────

  describe('onHITLGate', () => {
    it('creates an escalation item and returns its ID', async () => {
      const callbacks = createHITLCallbacks(manager);
      const node = makeHITLGateNode();
      const ctx = makeExecutionContext();

      const escalationId = await callbacks.onHITLGate(node, 'exec-1', ctx);

      expect(escalationId).toBeTruthy();
      expect(escalationId.startsWith('esc-')).toBe(true);
      expect(manager.size).toBe(1);
    });

    it('stores item in manager', async () => {
      const callbacks = createHITLCallbacks(manager);
      const node = makeHITLGateNode();
      const ctx = makeExecutionContext();

      const escalationId = await callbacks.onHITLGate(node, 'exec-1', ctx);
      const item = manager.getItem(escalationId);

      expect(item.status).toBe('pending');
      expect(item.chainId).toBe('chain-dag');
    });

    it('uses default priority (medium) when not configured', async () => {
      const callbacks = createHITLCallbacks(manager);
      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());

      expect(manager.getItem(id).priority).toBe('medium');
    });

    it('uses configured default priority', async () => {
      const callbacks = createHITLCallbacks(manager, { defaultPriority: 'critical' });
      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());

      expect(manager.getItem(id).priority).toBe('critical');
    });

    it('uses default reason (explicit_request) when not configured', async () => {
      const callbacks = createHITLCallbacks(manager);
      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());

      expect(manager.getItem(id).reason).toBe('explicit_request');
    });

    it('uses configured default reason', async () => {
      const callbacks = createHITLCallbacks(manager, { defaultReason: 'policy_violation' });
      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());

      expect(manager.getItem(id).reason).toBe('policy_violation');
    });

    it('uses default confidence of 0.5', async () => {
      const callbacks = createHITLCallbacks(manager);
      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());

      expect(manager.getItem(id).context.confidenceScore).toBe(0.5);
    });

    it('uses configured default confidence', async () => {
      const callbacks = createHITLCallbacks(manager, { defaultConfidence: 0.8 });
      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());

      expect(manager.getItem(id).context.confidenceScore).toBe(0.8);
    });

    it('populates context from node and execution context', async () => {
      const callbacks = createHITLCallbacks(manager);
      const node = makeHITLGateNode({ id: 'deploy-gate', label: 'Production Deploy' });
      const ctx = makeExecutionContext({ workflowId: 'wf-deploy' });

      const id = await callbacks.onHITLGate(node, 'exec-42', ctx);
      const item = manager.getItem(id);

      expect(item.context.agentId).toBe('workflow:wf-deploy');
      expect(item.context.sourceNodeId).toBe('deploy-gate');
      expect(item.context.workflowId).toBe('wf-deploy');
      expect(item.context.metadata).toEqual(
        expect.objectContaining({
          executionId: 'exec-42',
          nodeId: 'deploy-gate',
          nodeLabel: 'Production Deploy',
        }),
      );
    });

    it('uses node config prompt for proposedAction and reasoning', async () => {
      const callbacks = createHITLCallbacks(manager);
      const node = makeHITLGateNode({
        config: { prompt: 'Approve the deployment to production?' },
      });

      const id = await callbacks.onHITLGate(node, 'exec-1', makeExecutionContext());
      const item = manager.getItem(id);

      expect(item.context.proposedAction).toBe('Approve the deployment to production?');
      expect(item.context.reasoning).toBe('Approve the deployment to production?');
    });

    it('uses node label as fallback when no prompt', async () => {
      const callbacks = createHITLCallbacks(manager);
      const node = makeHITLGateNode({ label: 'Safety Check' });

      const id = await callbacks.onHITLGate(node, 'exec-1', makeExecutionContext());
      const item = manager.getItem(id);

      expect(item.context.proposedAction).toContain('Safety Check');
    });

    it('uses config.escalationChainId when specified on node', async () => {
      const altChain = makeChain({ id: 'chain-alt', name: 'Alt Chain' });
      const mgr = new HITLManager({
        chains: [makeChain(), altChain],
        thresholds: makeThresholds(),
        defaultChainId: 'chain-dag',
      });

      const callbacks = createHITLCallbacks(mgr);
      const node = makeHITLGateNode({
        config: { escalationChainId: 'chain-alt' },
      });

      const id = await callbacks.onHITLGate(node, 'exec-1', makeExecutionContext());
      expect(mgr.getItem(id).chainId).toBe('chain-alt');
    });

    it('uses options.defaultChainId when node config has no chain', async () => {
      const altChain = makeChain({ id: 'chain-alt', name: 'Alt Chain' });
      const mgr = new HITLManager({
        chains: [makeChain(), altChain],
        thresholds: makeThresholds(),
        defaultChainId: 'chain-dag',
      });

      const callbacks = createHITLCallbacks(mgr, { defaultChainId: 'chain-alt' });
      const node = makeHITLGateNode(); // no config.escalationChainId

      const id = await callbacks.onHITLGate(node, 'exec-1', makeExecutionContext());
      expect(mgr.getItem(id).chainId).toBe('chain-alt');
    });

    it('falls back to manager default chain when no chain specified anywhere', async () => {
      const callbacks = createHITLCallbacks(manager);
      const node = makeHITLGateNode();

      const id = await callbacks.onHITLGate(node, 'exec-1', makeExecutionContext());
      expect(manager.getItem(id).chainId).toBe('chain-dag');
    });

    it('uses config reason/priority overrides from node', async () => {
      const callbacks = createHITLCallbacks(manager);
      const node = makeHITLGateNode({
        config: {
          reason: 'policy_violation',
          priority: 'critical',
        },
      });

      const id = await callbacks.onHITLGate(node, 'exec-1', makeExecutionContext());
      const item = manager.getItem(id);

      expect(item.reason).toBe('policy_violation');
      expect(item.priority).toBe('critical');
    });

    it('includes traceId in metadata', async () => {
      const callbacks = createHITLCallbacks(manager);
      const ctx = makeExecutionContext({ traceId: 'trace-abc-123' });

      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', ctx);
      const item = manager.getItem(id);

      expect(item.context.metadata).toEqual(expect.objectContaining({ traceId: 'trace-abc-123' }));
    });

    it('handles multiple gate invocations creating distinct items', async () => {
      const callbacks = createHITLCallbacks(manager);
      const ctx = makeExecutionContext();

      const id1 = await callbacks.onHITLGate(makeHITLGateNode({ id: 'gate-1' }), 'exec-1', ctx);
      const id2 = await callbacks.onHITLGate(makeHITLGateNode({ id: 'gate-2' }), 'exec-1', ctx);
      const id3 = await callbacks.onHITLGate(makeHITLGateNode({ id: 'gate-3' }), 'exec-2', ctx);

      expect(new Set([id1, id2, id3]).size).toBe(3);
      expect(manager.size).toBe(3);
    });
  });

  // ── resolveEscalation ─────────────────────────────────────

  describe('resolveEscalation', () => {
    it('returns approved:true for approved items', async () => {
      const callbacks = createHITLCallbacks(manager);
      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());

      manager.claim(id, 'alice');
      manager.approve(id, 'alice', 'Ship it');

      const result = await callbacks.resolveEscalation(id);
      expect(result.approved).toBe(true);
      expect(result.output).toBe('Ship it');
    });

    it('returns approved:false for rejected items', async () => {
      const callbacks = createHITLCallbacks(manager);
      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());

      manager.claim(id, 'alice');
      manager.reject(id, 'alice', 'Not ready');

      const result = await callbacks.resolveEscalation(id);
      expect(result.approved).toBe(false);
      expect(result.output).toBe('Not ready');
    });

    it('returns approved:false with timeout message for timed_out items', async () => {
      // Create single-level chain so timeout → timed_out status
      const singleChain = makeChain({
        id: 'single',
        levels: [{ level: 1, name: 'Only', reviewerIds: ['r1'], timeoutMs: 1000 }],
      });
      const mgr = new HITLManager({
        chains: [singleChain],
        thresholds: makeThresholds(),
        defaultChainId: 'single',
      });
      const cb = createHITLCallbacks(mgr);

      const id = await cb.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());
      // Use far-future timestamp since onHITLGate uses real Date.now()
      mgr.processTimeouts('2099-01-01T00:00:00.000Z');

      const result = await cb.resolveEscalation(id);
      expect(result.approved).toBe(false);
      expect(result.output).toBe('Escalation timed out');
    });

    it('throws for pending (unresolved) items', async () => {
      const callbacks = createHITLCallbacks(manager);
      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());

      await expect(callbacks.resolveEscalation(id)).rejects.toThrow('not yet resolved');
    });

    it('throws for claimed (unresolved) items', async () => {
      const callbacks = createHITLCallbacks(manager);
      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());
      manager.claim(id, 'alice');

      await expect(callbacks.resolveEscalation(id)).rejects.toThrow('not yet resolved');
    });

    it('throws for non-existent escalation ID', async () => {
      const callbacks = createHITLCallbacks(manager);

      await expect(callbacks.resolveEscalation('nonexistent-id')).rejects.toThrow('not found');
    });

    it('returns null output when approved without comment', async () => {
      const callbacks = createHITLCallbacks(manager);
      const id = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', makeExecutionContext());

      manager.claim(id, 'alice');
      manager.approve(id, 'alice'); // no comment

      const result = await callbacks.resolveEscalation(id);
      expect(result.approved).toBe(true);
      expect(result.output).toBeNull();
    });
  });

  // ── Full flow integration ─────────────────────────────────

  describe('full flow', () => {
    it('gate → claim → approve → resolve', async () => {
      const callbacks = createHITLCallbacks(manager);
      const ctx = makeExecutionContext();

      // 1. DAG engine hits HITL gate
      const escalationId = await callbacks.onHITLGate(makeHITLGateNode(), 'exec-1', ctx);
      expect(manager.getItem(escalationId).status).toBe('pending');

      // 2. Reviewer claims
      manager.claim(escalationId, 'alice');
      expect(manager.getItem(escalationId).status).toBe('claimed');

      // 3. Reviewer approves
      manager.approve(escalationId, 'alice', 'All good');

      // 4. DAG engine resolves
      const result = await callbacks.resolveEscalation(escalationId);
      expect(result.approved).toBe(true);
      expect(result.output).toBe('All good');
    });

    it('gate → claim → reject → resolve', async () => {
      const callbacks = createHITLCallbacks(manager);
      const escalationId = await callbacks.onHITLGate(
        makeHITLGateNode(),
        'exec-1',
        makeExecutionContext(),
      );

      manager.claim(escalationId, 'bob');
      manager.reject(escalationId, 'bob', 'Failed review');

      const result = await callbacks.resolveEscalation(escalationId);
      expect(result.approved).toBe(false);
      expect(result.output).toBe('Failed review');
    });

    it('gate → timeout → auto-escalate → claim → approve → resolve', async () => {
      const callbacks = createHITLCallbacks(manager);
      const escalationId = await callbacks.onHITLGate(
        makeHITLGateNode(),
        'exec-1',
        makeExecutionContext(),
      );

      // Use far-future timestamp since onHITLGate uses real Date.now()
      manager.processTimeouts('2099-01-01T00:00:00.000Z');
      const item = manager.getItem(escalationId);
      expect(item.currentLevel).toBe(2);
      expect(item.status).toBe('pending');

      // L2 reviewer claims and approves
      manager.claim(escalationId, 'charlie');
      manager.approve(escalationId, 'charlie', 'Escalated but approved');

      const result = await callbacks.resolveEscalation(escalationId);
      expect(result.approved).toBe(true);
    });

    it('multiple concurrent gates in same execution', async () => {
      const callbacks = createHITLCallbacks(manager);
      const ctx = makeExecutionContext();

      const id1 = await callbacks.onHITLGate(
        makeHITLGateNode({ id: 'gate-a', label: 'Gate A' }),
        'exec-1',
        ctx,
      );
      const id2 = await callbacks.onHITLGate(
        makeHITLGateNode({ id: 'gate-b', label: 'Gate B' }),
        'exec-1',
        ctx,
      );

      // Approve gate A, reject gate B
      manager.claim(id1, 'alice');
      manager.approve(id1, 'alice', 'Gate A OK');
      manager.claim(id2, 'bob');
      manager.reject(id2, 'bob', 'Gate B failed');

      const result1 = await callbacks.resolveEscalation(id1);
      const result2 = await callbacks.resolveEscalation(id2);

      expect(result1.approved).toBe(true);
      expect(result2.approved).toBe(false);
    });
  });
});
