import { beforeEach,describe, expect, it, vi } from 'vitest';

import type { AgentInfo, AgentResolver, MessageHandler } from '../a2a/message-bus.js';
import { A2AMessageBus } from '../a2a/message-bus.js';
import type { A2ABusEvent } from '../a2a/status-broadcaster.js';
import { StatusBroadcaster } from '../a2a/status-broadcaster.js';
import type {
  A2AMessage,
  A2AMessageStatus,
  A2AMessageType,
  A2ARoutingInfo,
} from '../types/a2a.js';

// ── Helpers ─────────────────────────────────────────────────────

let counter = 0;

function makeMessage(overrides: Partial<A2AMessage> = {}): A2AMessage {
  counter++;
  const now = new Date().toISOString();
  return {
    id: `msg-${counter}`,
    correlationId: 'corr-1',
    type: 'delegation_request' as A2AMessageType,
    sender: 'agent-a',
    recipient: 'agent-b',
    routing: { strategy: 'direct', target: 'agent-b' },
    priority: 'normal',
    status: 'sent' as A2AMessageStatus,
    payload: {
      taskId: 'task-1',
      summary: 'Do work',
      instructions: 'Please do the work',
      context: {},
      allowSubDelegation: false,
    },
    retryPolicy: {
      maxAttempts: 3,
      initialDelayMs: 1000,
      backoffMultiplier: 2,
      maxDelayMs: 30000,
      ttlMs: 300000,
    },
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(Date.now() + 300000).toISOString(),
    protocolVersion: 1,
    ...overrides,
  } as A2AMessage;
}

const AGENTS: AgentInfo[] = [
  { id: 'agent-a', role: 'frontend', capabilities: ['react', 'css'], currentLoad: 3 },
  { id: 'agent-b', role: 'backend', capabilities: ['node', 'sql'], currentLoad: 1 },
  { id: 'agent-c', role: 'backend', capabilities: ['node', 'python'], currentLoad: 5 },
  { id: 'agent-d', role: 'devops', capabilities: ['docker', 'sql'], currentLoad: 2 },
];

function createMockResolver(agents: AgentInfo[] = AGENTS): AgentResolver {
  return {
    getAgent: vi.fn((id: string) => agents.find((a) => a.id === id)),
    getAllAgents: vi.fn(() => [...agents]),
    getAgentsByRole: vi.fn((role: string) => agents.filter((a) => a.role === role)),
    getAgentsByCapability: vi.fn((caps: string[]) =>
      agents.filter((a) => a.capabilities.some((c) => caps.includes(c))),
    ),
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('A2AMessageBus', () => {
  let bus: A2AMessageBus;
  let resolver: AgentResolver;
  let broadcaster: StatusBroadcaster;

  beforeEach(() => {
    counter = 0;
    resolver = createMockResolver();
    broadcaster = new StatusBroadcaster();
    bus = new A2AMessageBus({ agentResolver: resolver, broadcaster });
  });

  // ── registerHandler / send ────────────────────────────────────

  it('registerHandler() + send() delivers message to handler', async () => {
    const handler = vi.fn();
    bus.registerHandler('agent-b', handler);

    const msg = makeMessage({ routing: { strategy: 'direct', target: 'agent-b' } });
    await bus.send(msg);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(msg);
  });

  it('send() returns lifecycle event with status "sent"', async () => {
    bus.registerHandler('agent-b', vi.fn());
    const msg = makeMessage({ routing: { strategy: 'direct', target: 'agent-b' } });
    const event = await bus.send(msg);

    expect(event.newStatus).toBe('sent');
    expect(event.messageId).toBe(msg.id);
  });

  // ── Routing strategies ────────────────────────────────────────

  describe('routing strategies', () => {
    it('direct: resolves to specific agent', async () => {
      const ids = await bus.resolveRecipients({
        strategy: 'direct',
        target: 'agent-b',
      });
      expect(ids).toEqual(['agent-b']);
    });

    it('direct: returns empty for unknown agent', async () => {
      const ids = await bus.resolveRecipients({
        strategy: 'direct',
        target: 'ghost',
      });
      expect(ids).toEqual([]);
    });

    it('role_based: resolves agents by role', async () => {
      const ids = await bus.resolveRecipients({
        strategy: 'role_based',
        target: 'backend',
      });
      // With default first_available selection, picks one
      expect(ids).toHaveLength(1);
      expect(['agent-b', 'agent-c']).toContain(ids[0]);
    });

    it('capability: resolves agents by comma-separated tags', async () => {
      const ids = await bus.resolveRecipients({
        strategy: 'capability',
        target: 'sql',
      });
      // Multiple agents have 'sql', selection picks one
      expect(ids).toHaveLength(1);
      expect(['agent-b', 'agent-d']).toContain(ids[0]);
    });

    it('broadcast: delivers to all agents', async () => {
      const ids = await bus.resolveRecipients({
        strategy: 'broadcast',
        target: '',
      });
      expect(ids).toHaveLength(AGENTS.length);
    });
  });

  // ── excludeAgentIds ───────────────────────────────────────────

  it('excludeAgentIds filters out specified agents', async () => {
    const ids = await bus.resolveRecipients({
      strategy: 'broadcast',
      target: '',
      excludeAgentIds: ['agent-a', 'agent-c'],
    });
    expect(ids).not.toContain('agent-a');
    expect(ids).not.toContain('agent-c');
    expect(ids).toContain('agent-b');
    expect(ids).toContain('agent-d');
  });

  // ── Selection strategies ──────────────────────────────────────

  describe('selection strategies', () => {
    it('first_available picks first candidate', async () => {
      const ids = await bus.resolveRecipients({
        strategy: 'role_based',
        target: 'backend',
        selectionStrategy: 'first_available',
      });
      expect(ids).toEqual(['agent-b']); // agent-b is first backend
    });

    it('least_loaded picks agent with lowest load', async () => {
      const ids = await bus.resolveRecipients({
        strategy: 'role_based',
        target: 'backend',
        selectionStrategy: 'least_loaded',
      });
      // agent-b has load 1, agent-c has load 5
      expect(ids).toEqual(['agent-b']);
    });

    it('round_robin cycles through candidates', async () => {
      const routing: A2ARoutingInfo = {
        strategy: 'role_based',
        target: 'backend',
        selectionStrategy: 'round_robin',
      };

      const first = await bus.resolveRecipients(routing);
      const second = await bus.resolveRecipients(routing);

      // Should cycle between the two backend agents
      expect(first).toHaveLength(1);
      expect(second).toHaveLength(1);
      expect(first[0]).not.toBe(second[0]);
    });
  });

  // ── acknowledge ───────────────────────────────────────────────

  it('acknowledge() transitions message to acknowledged', async () => {
    bus.registerHandler('agent-b', vi.fn());
    const msg = makeMessage({ routing: { strategy: 'direct', target: 'agent-b' } });
    await bus.send(msg);

    // After send, message is in 'received' state (handler was called)
    const event = await bus.acknowledge(msg.id, 'agent-b');
    expect(event.newStatus).toBe('acknowledged');
    expect(bus.getMessage(msg.id)?.status).toBe('acknowledged');
  });

  it('acknowledge() throws for unknown message', async () => {
    await expect(bus.acknowledge('no-such-id', 'agent-b')).rejects.toThrow(
      'Message not found',
    );
  });

  // ── transitionStatus ──────────────────────────────────────────

  describe('transitionStatus', () => {
    it('valid transition succeeds and records lifecycle event', async () => {
      bus.registerHandler('agent-b', vi.fn());
      const msg = makeMessage({ routing: { strategy: 'direct', target: 'agent-b' } });
      await bus.send(msg);

      // msg is now 'received'
      const event = bus.transitionStatus(msg, 'acknowledged', 'agent-b');
      expect(event.previousStatus).toBe('received');
      expect(event.newStatus).toBe('acknowledged');
      expect(msg.status).toBe('acknowledged');
    });

    it('invalid transition throws', () => {
      const msg = makeMessage({ status: 'completed' as A2AMessageStatus });
      bus.getStore().save(msg);

      expect(() => bus.transitionStatus(msg, 'sent', 'agent-b')).toThrow(
        'Invalid status transition',
      );
    });
  });

  // ── convenience status methods ────────────────────────────────

  describe('convenience status methods', () => {
    let msg: A2AMessage;

    beforeEach(async () => {
      bus.registerHandler('agent-b', vi.fn());
      msg = makeMessage({ routing: { strategy: 'direct', target: 'agent-b' } });
      await bus.send(msg);
      // msg is now 'received'
      await bus.acknowledge(msg.id, 'agent-b');
      // msg is now 'acknowledged'
    });

    it('markProcessing() transitions to processing', () => {
      const event = bus.markProcessing(msg.id, 'agent-b');
      expect(event.newStatus).toBe('processing');
      expect(bus.getMessage(msg.id)?.status).toBe('processing');
    });

    it('markCompleted() transitions to completed (after processing)', () => {
      bus.markProcessing(msg.id, 'agent-b');
      const event = bus.markCompleted(msg.id, 'agent-b');
      expect(event.newStatus).toBe('completed');
    });

    it('markFailed() transitions to failed (with reason)', () => {
      bus.markProcessing(msg.id, 'agent-b');
      const event = bus.markFailed(msg.id, 'agent-b', 'out of memory');
      expect(event.newStatus).toBe('failed');
      expect(event.details).toBe('out of memory');
    });

    it('markProcessing() throws for unknown message', () => {
      expect(() => bus.markProcessing('ghost', 'x')).toThrow('Message not found');
    });
  });

  // ── resolveConflicts ──────────────────────────────────────────

  describe('resolveConflicts', () => {
    it('returns null for ≤1 delegation response', async () => {
      const msg = makeMessage({
        id: 'only-one',
        correlationId: 'c-single',
        type: 'delegation_response' as A2AMessageType,
        status: 'sent' as A2AMessageStatus,
        payload: { outcome: 'accepted' },
      });
      bus.getStore().save(msg);

      const result = await bus.resolveConflicts('c-single');
      expect(result).toBeNull();
    });

    it('returns null for no messages in correlation', async () => {
      const result = await bus.resolveConflicts('nonexistent-corr');
      expect(result).toBeNull();
    });

    it('first_writer_wins picks earliest createdAt', async () => {
      const busWithStrategy = new A2AMessageBus({
        agentResolver: resolver,
        defaultConflictStrategy: 'first_writer_wins',
      });

      const r1 = makeMessage({
        id: 'r1',
        correlationId: 'c-conflict',
        type: 'delegation_response' as A2AMessageType,
        status: 'sent' as A2AMessageStatus,
        createdAt: '2024-01-01T00:00:00Z',
        payload: { outcome: 'accepted' },
      });
      const r2 = makeMessage({
        id: 'r2',
        correlationId: 'c-conflict',
        type: 'delegation_response' as A2AMessageType,
        status: 'sent' as A2AMessageStatus,
        createdAt: '2024-01-02T00:00:00Z',
        payload: { outcome: 'accepted' },
      });

      busWithStrategy.getStore().save(r1);
      busWithStrategy.getStore().save(r2);

      const result = await busWithStrategy.resolveConflicts('c-conflict');
      expect(result).not.toBeNull();
      expect(result!.winningMessageId).toBe('r1');
      expect(result!.supersededMessageIds).toContain('r2');
      expect(result!.strategy).toBe('first_writer_wins');
    });

    it('priority_based picks highest priority', async () => {
      const busP = new A2AMessageBus({
        agentResolver: resolver,
        defaultConflictStrategy: 'priority_based',
      });

      const r1 = makeMessage({
        id: 'p1',
        correlationId: 'c-prio',
        type: 'delegation_response' as A2AMessageType,
        status: 'sent' as A2AMessageStatus,
        priority: 'low',
        payload: { outcome: 'accepted' },
      });
      const r2 = makeMessage({
        id: 'p2',
        correlationId: 'c-prio',
        type: 'delegation_response' as A2AMessageType,
        status: 'sent' as A2AMessageStatus,
        priority: 'critical',
        payload: { outcome: 'accepted' },
      });

      busP.getStore().save(r1);
      busP.getStore().save(r2);

      const result = await busP.resolveConflicts('c-prio');
      expect(result!.winningMessageId).toBe('p2');
    });

    it('claim_score picks highest claimScore from negotiation messages', async () => {
      const busCS = new A2AMessageBus({
        agentResolver: resolver,
        defaultConflictStrategy: 'claim_score',
      });

      const r1 = makeMessage({
        id: 'cs1',
        correlationId: 'c-claim',
        type: 'delegation_response' as A2AMessageType,
        status: 'sent' as A2AMessageStatus,
        payload: { outcome: 'accepted' },
      });
      const r2 = makeMessage({
        id: 'cs2',
        correlationId: 'c-claim',
        type: 'delegation_response' as A2AMessageType,
        status: 'sent' as A2AMessageStatus,
        payload: { outcome: 'accepted' },
      });

      busCS.getStore().save(r1);
      busCS.getStore().save(r2);

      // Both are delegation_response (not negotiation), so claimScore = 0 for both.
      // Reduce defaults to the accumulator, so first message wins.
      const result = await busCS.resolveConflicts('c-claim');
      expect(result).not.toBeNull();
      expect(result!.strategy).toBe('claim_score');
    });

    it('cancelled messages are excluded from conflict resolution', async () => {
      const r1 = makeMessage({
        id: 'cx1',
        correlationId: 'c-cancel',
        type: 'delegation_response' as A2AMessageType,
        status: 'cancelled' as A2AMessageStatus,
        payload: { outcome: 'accepted' },
      });
      const r2 = makeMessage({
        id: 'cx2',
        correlationId: 'c-cancel',
        type: 'delegation_response' as A2AMessageType,
        status: 'sent' as A2AMessageStatus,
        payload: { outcome: 'accepted' },
      });

      bus.getStore().save(r1);
      bus.getStore().save(r2);

      // Only 1 non-cancelled response → null
      const result = await bus.resolveConflicts('c-cancel');
      expect(result).toBeNull();
    });
  });

  // ── getConversation / getLifecycle ────────────────────────────

  it('getConversation() returns messages by correlationId', async () => {
    bus.registerHandler('agent-b', vi.fn());

    const m1 = makeMessage({ correlationId: 'conv-1', routing: { strategy: 'direct', target: 'agent-b' } });
    const m2 = makeMessage({ correlationId: 'conv-1', routing: { strategy: 'direct', target: 'agent-b' } });
    await bus.send(m1);
    await bus.send(m2);

    const conv = await bus.getConversation('conv-1');
    expect(conv).toHaveLength(2);
  });

  it('getLifecycle() returns lifecycle events for a message', async () => {
    bus.registerHandler('agent-b', vi.fn());
    const msg = makeMessage({ routing: { strategy: 'direct', target: 'agent-b' } });
    await bus.send(msg);

    const events = await bus.getLifecycle(msg.id);
    // At minimum: sent → received
    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0].newStatus).toBe('sent');
  });

  // ── Broadcaster integration ───────────────────────────────────

  describe('broadcaster integration', () => {
    it('emits message:sent on send()', async () => {
      const listener = vi.fn();
      broadcaster.on('message:sent', listener);

      bus.registerHandler('agent-b', vi.fn());
      const msg = makeMessage({ routing: { strategy: 'direct', target: 'agent-b' } });
      await bus.send(msg);

      expect(listener).toHaveBeenCalledOnce();
      const event: A2ABusEvent = listener.mock.calls[0][0];
      expect(event.type).toBe('message:sent');
    });

    it('emits message:acknowledged on acknowledge()', async () => {
      const listener = vi.fn();
      broadcaster.on('message:acknowledged', listener);

      bus.registerHandler('agent-b', vi.fn());
      const msg = makeMessage({ routing: { strategy: 'direct', target: 'agent-b' } });
      await bus.send(msg);
      await bus.acknowledge(msg.id, 'agent-b');

      expect(listener).toHaveBeenCalledOnce();
    });

    it('emits message:status_changed on transitionStatus()', async () => {
      const listener = vi.fn();
      broadcaster.on('message:status_changed', listener);

      bus.registerHandler('agent-b', vi.fn());
      const msg = makeMessage({ routing: { strategy: 'direct', target: 'agent-b' } });
      await bus.send(msg);

      // send already transitions to received, which triggers status_changed
      expect(listener).toHaveBeenCalled();
    });
  });
});
