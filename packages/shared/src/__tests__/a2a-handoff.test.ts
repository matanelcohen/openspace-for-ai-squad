import { beforeEach, describe, expect, it, vi } from 'vitest';

import { A2AMessageBus } from '../a2a/message-bus.js';
import { CorrelationTracker } from '../a2a/correlation-tracker.js';
import { StatusBroadcaster } from '../a2a/status-broadcaster.js';
import { HandoffManager } from '../a2a/handoff.js';
import type { HandoffRequest } from '../a2a/handoff.js';
import type { AgentResolver } from '../a2a/message-bus.js';

// ── Helpers ──────────────────────────────────────────────────────

function createMockResolver(): AgentResolver {
  return {
    getAgent: (id: string) => ({ id, role: 'Backend', capabilities: ['api'], currentLoad: 1 }),
    getAllAgents: () => [
      { id: 'bender', role: 'Backend', capabilities: ['api'], currentLoad: 1 },
      { id: 'fry', role: 'Frontend', capabilities: ['ui'], currentLoad: 2 },
    ],
    getAgentsByRole: (role: string) =>
      [
        { id: 'bender', role: 'Backend', capabilities: ['api'], currentLoad: 1 },
        { id: 'fry', role: 'Frontend', capabilities: ['ui'], currentLoad: 2 },
      ].filter((a) => a.role === role),
    getAgentsByCapability: (caps: string[]) =>
      [
        { id: 'bender', role: 'Backend', capabilities: ['api'], currentLoad: 1 },
        { id: 'fry', role: 'Frontend', capabilities: ['ui'], currentLoad: 2 },
      ].filter((a) => a.capabilities.some((c) => caps.includes(c))),
  };
}

let idSeq = 0;
function deterministicId(prefix: string): string {
  return `${prefix}-${++idSeq}`;
}

function createManager(opts?: { broadcaster?: StatusBroadcaster; withTracker?: boolean }) {
  const bus = new A2AMessageBus({ agentResolver: createMockResolver(), broadcaster: opts?.broadcaster });
  const tracker = opts?.withTracker ? new CorrelationTracker() : undefined;
  // Register handlers so sent → received lifecycle works for acknowledge tests
  bus.registerHandler('bender', vi.fn());
  bus.registerHandler('fry', vi.fn());
  const manager = new HandoffManager({
    messageBus: bus,
    correlationTracker: tracker,
    broadcaster: opts?.broadcaster,
    generateId: deterministicId,
  });
  return { bus, tracker, manager };
}

function baseHandoffRequest(overrides: Partial<HandoffRequest> = {}): HandoffRequest {
  return {
    fromAgentId: 'leela',
    routing: { strategy: 'direct', target: 'bender' },
    taskId: 'task-42',
    reason: 'out_of_scope',
    description: 'Frontend work needed',
    workState: { progress: 50 },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('HandoffManager', () => {
  beforeEach(() => {
    idSeq = 0;
  });

  // ── handoff ─────────────────────────────────────────────────

  describe('handoff()', () => {
    it('sends a handoff message and tracks as pending', async () => {
      const { manager } = createManager();
      const result = await manager.handoff(baseHandoffRequest());

      expect(result.handoffMessage.type).toBe('handoff');
      expect(result.handoffMessage.sender).toBe('leela');
      expect(result.handoffMessage.recipient).toBe('bender');
      expect(result.correlationId).toBeTruthy();

      const pending = manager.getPending(result.handoffMessage.id);
      expect(pending).toBeDefined();
      expect(pending!.acknowledged).toBe(false);
      expect(pending!.taskId).toBe('task-42');
    });

    it('uses existing correlationId when provided', async () => {
      const { manager } = createManager();
      const result = await manager.handoff(
        baseHandoffRequest({ correlationId: 'existing-corr' }),
      );
      expect(result.correlationId).toBe('existing-corr');
    });

    it('returns resolved recipientIds', async () => {
      const { manager } = createManager();
      const result = await manager.handoff(baseHandoffRequest());
      expect(result.recipientIds).toContain('bender');
    });

    it('emits handoff:initiated via broadcaster', async () => {
      const broadcaster = new StatusBroadcaster();
      const listener = vi.fn();
      broadcaster.on('handoff:initiated', listener);

      const { manager } = createManager({ broadcaster });
      await manager.handoff(baseHandoffRequest());

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'handoff:initiated',
          data: expect.objectContaining({ taskId: 'task-42' }),
        }),
      );
    });
  });

  // ── acknowledgeHandoff ──────────────────────────────────────

  describe('acknowledgeHandoff()', () => {
    it('marks pending as acknowledged and transitions to processing', async () => {
      const { manager } = createManager();
      const result = await manager.handoff(baseHandoffRequest());

      const acked = await manager.acknowledgeHandoff(result.handoffMessage.id, 'bender');
      expect(acked.acknowledged).toBe(true);
      expect(acked.acknowledgedBy).toBe('bender');
    });

    it('throws for unknown handoff', async () => {
      const { manager } = createManager();
      await expect(
        manager.acknowledgeHandoff('nonexistent', 'bender'),
      ).rejects.toThrow('Pending handoff not found');
    });

    it('throws for already acknowledged handoff', async () => {
      const { manager } = createManager();
      const result = await manager.handoff(baseHandoffRequest());

      await manager.acknowledgeHandoff(result.handoffMessage.id, 'bender');

      await expect(
        manager.acknowledgeHandoff(result.handoffMessage.id, 'fry'),
      ).rejects.toThrow('Handoff already acknowledged');
    });

    it('emits handoff:completed via broadcaster', async () => {
      const broadcaster = new StatusBroadcaster();
      const listener = vi.fn();
      broadcaster.on('handoff:completed', listener);

      const { manager } = createManager({ broadcaster });
      const result = await manager.handoff(baseHandoffRequest());
      await manager.acknowledgeHandoff(result.handoffMessage.id, 'bender');

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'handoff:completed',
          data: expect.objectContaining({
            previousOwner: 'leela',
            newOwner: 'bender',
          }),
        }),
      );
    });
  });

  // ── getPending ──────────────────────────────────────────────

  describe('getPending()', () => {
    it('returns a specific pending handoff', async () => {
      const { manager } = createManager();
      const result = await manager.handoff(baseHandoffRequest());

      const pending = manager.getPending(result.handoffMessage.id);
      expect(pending).toBeDefined();
      expect(pending!.taskId).toBe('task-42');
    });

    it('returns undefined for unknown id', () => {
      const { manager } = createManager();
      expect(manager.getPending('nonexistent')).toBeUndefined();
    });
  });

  // ── getPendingHandoffs ──────────────────────────────────────

  describe('getPendingHandoffs()', () => {
    it('returns only unacknowledged handoffs', async () => {
      const { manager } = createManager();

      const h1 = await manager.handoff(baseHandoffRequest({ taskId: 'task-1' }));
      await manager.handoff(baseHandoffRequest({ taskId: 'task-2' }));

      // Acknowledge one
      await manager.acknowledgeHandoff(h1.handoffMessage.id, 'bender');

      const pending = manager.getPendingHandoffs();
      expect(pending).toHaveLength(1);
      expect(pending[0]!.taskId).toBe('task-2');
    });
  });

  // ── getHandoffsForTask ──────────────────────────────────────

  describe('getHandoffsForTask()', () => {
    it('filters handoffs by taskId', async () => {
      const { manager } = createManager();

      await manager.handoff(baseHandoffRequest({ taskId: 'task-1' }));
      await manager.handoff(baseHandoffRequest({ taskId: 'task-2' }));
      await manager.handoff(baseHandoffRequest({ taskId: 'task-1' }));

      const result = manager.getHandoffsForTask('task-1');
      expect(result).toHaveLength(2);
      expect(result.every((h) => h.taskId === 'task-1')).toBe(true);
    });

    it('returns empty array when no match', () => {
      const { manager } = createManager();
      expect(manager.getHandoffsForTask('nonexistent')).toEqual([]);
    });
  });

  // ── remove ──────────────────────────────────────────────────

  describe('remove()', () => {
    it('removes a handoff from tracking', async () => {
      const { manager } = createManager();
      const result = await manager.handoff(baseHandoffRequest());

      expect(manager.remove(result.handoffMessage.id)).toBe(true);
      expect(manager.getPending(result.handoffMessage.id)).toBeUndefined();
    });

    it('returns false for unknown handoff', () => {
      const { manager } = createManager();
      expect(manager.remove('nonexistent')).toBe(false);
    });
  });

  // ── clear ───────────────────────────────────────────────────

  describe('clear()', () => {
    it('removes all tracked handoffs', async () => {
      const { manager } = createManager();
      await manager.handoff(baseHandoffRequest({ taskId: 'task-1' }));
      await manager.handoff(baseHandoffRequest({ taskId: 'task-2' }));

      manager.clear();

      expect(manager.getPendingHandoffs()).toEqual([]);
    });
  });
});
