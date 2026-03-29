import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AgentResolver } from '../a2a/message-bus.js';
import { A2AMessageBus } from '../a2a/message-bus.js';
import type { NegotiationProposal } from '../a2a/negotiation.js';
import { NegotiationManager } from '../a2a/negotiation.js';
import { StatusBroadcaster } from '../a2a/status-broadcaster.js';

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

function createNegotiationManager(opts?: { broadcaster?: StatusBroadcaster }) {
  const bus = new A2AMessageBus({ agentResolver: createMockResolver(), broadcaster: opts?.broadcaster });
  const manager = new NegotiationManager({
    messageBus: bus,
    broadcaster: opts?.broadcaster,
    generateId: deterministicId,
  });
  return { bus, manager };
}

function baseProposal(overrides: Partial<NegotiationProposal> = {}): NegotiationProposal {
  return {
    fromAgentId: 'leela',
    toAgentId: 'bender',
    subject: 'Task ownership',
    proposal: { taskId: 'task-42', scope: 'api' },
    reasoning: 'I have the expertise',
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────

describe('NegotiationManager', () => {
  beforeEach(() => {
    idSeq = 0;
  });

  // ── propose ─────────────────────────────────────────────────

  describe('propose()', () => {
    it('creates a negotiation, sends a message, and records history', async () => {
      const { manager } = createNegotiationManager();
      const state = await manager.propose(baseProposal());

      expect(state.negotiationId).toBeTruthy();
      expect(state.phase).toBe('propose');
      expect(state.initiatorId).toBe('leela');
      expect(state.subject).toBe('Task ownership');
      expect(state.participants.has('leela')).toBe(true);
      expect(state.participants.has('bender')).toBe(true);
      expect(state.history).toHaveLength(1);
      expect(state.history[0]!.phase).toBe('propose');
      expect(state.history[0]!.agentId).toBe('leela');
    });

    it('emits negotiation:updated via broadcaster', async () => {
      const broadcaster = new StatusBroadcaster();
      const listener = vi.fn();
      broadcaster.on('negotiation:updated', listener);

      const { manager } = createNegotiationManager({ broadcaster });
      await manager.propose(baseProposal());

      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'negotiation:updated',
          data: expect.objectContaining({ phase: 'propose' }),
        }),
      );
    });

    it('uses custom maxRounds', async () => {
      const { manager } = createNegotiationManager();
      const state = await manager.propose(baseProposal({ maxRounds: 3 }));
      expect(state.maxRounds).toBe(3);
    });

    it('defaults maxRounds to 5', async () => {
      const { manager } = createNegotiationManager();
      const state = await manager.propose(baseProposal());
      expect(state.maxRounds).toBe(5);
    });

    it('includes claimScore in negotiation message payload', async () => {
      const { manager } = createNegotiationManager();
      const state = await manager.propose(baseProposal({ claimScore: 0.85 }));
      expect(state.history[0]!.message.payload.claimScore).toBe(0.85);
    });
  });

  // ── counter ─────────────────────────────────────────────────

  describe('counter()', () => {
    it('advances phase to counter and adds a turn to history', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());

      const state = await manager.counter(
        initial.negotiationId,
        'bender',
        { taskId: 'task-42', scope: 'api-lite' },
        'Simpler scope is better',
      );

      expect(state.phase).toBe('counter');
      expect(state.history).toHaveLength(2);
      expect(state.history[1]!.phase).toBe('counter');
      expect(state.history[1]!.agentId).toBe('bender');
    });

    it('includes claimScore in counter turn', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());

      const state = await manager.counter(
        initial.negotiationId,
        'bender',
        { scope: 'revised' },
        'Better fit',
        0.9,
      );

      expect(state.history[1]!.message.payload.claimScore).toBe(0.9);
    });
  });

  // ── accept ──────────────────────────────────────────────────

  describe('accept()', () => {
    it('sets the phase to accept (terminal)', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());

      const state = await manager.accept(initial.negotiationId, 'bender');
      expect(state.phase).toBe('accept');
      expect(manager.isTerminal(initial.negotiationId)).toBe(true);
    });

    it('records the accept turn in history', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());

      const state = await manager.accept(initial.negotiationId, 'bender', 'Looks good');
      expect(state.history).toHaveLength(2);
      expect(state.history[1]!.phase).toBe('accept');
    });
  });

  // ── reject ──────────────────────────────────────────────────

  describe('reject()', () => {
    it('sets the phase to reject (terminal)', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());

      const state = await manager.reject(initial.negotiationId, 'bender', 'Not interested');
      expect(state.phase).toBe('reject');
      expect(manager.isTerminal(initial.negotiationId)).toBe(true);
    });
  });

  // ── withdraw ────────────────────────────────────────────────

  describe('withdraw()', () => {
    it('sets the phase to withdraw (terminal)', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());

      const state = await manager.withdraw(initial.negotiationId, 'leela');
      expect(state.phase).toBe('withdraw');
      expect(manager.isTerminal(initial.negotiationId)).toBe(true);
    });
  });

  // ── Invalid phase transitions ───────────────────────────────

  describe('invalid phase transitions', () => {
    it('throws when trying to counter after accept', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());
      await manager.accept(initial.negotiationId, 'bender');

      await expect(
        manager.counter(initial.negotiationId, 'leela', {}, 'Nope'),
      ).rejects.toThrow('Invalid negotiation transition: accept → counter');
    });

    it('throws when trying to accept after reject', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());
      await manager.reject(initial.negotiationId, 'bender', 'No');

      await expect(
        manager.accept(initial.negotiationId, 'leela'),
      ).rejects.toThrow('Invalid negotiation transition: reject → accept');
    });

    it('throws when trying to withdraw after withdraw', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());
      await manager.withdraw(initial.negotiationId, 'leela');

      await expect(
        manager.withdraw(initial.negotiationId, 'bender'),
      ).rejects.toThrow('Invalid negotiation transition: withdraw → withdraw');
    });
  });

  // ── Max counter rounds ──────────────────────────────────────

  describe('max counter rounds', () => {
    it('enforces maxRounds limit', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal({ maxRounds: 2 }));

      await manager.counter(initial.negotiationId, 'bender', { v: 1 }, 'r1');
      await manager.counter(initial.negotiationId, 'leela', { v: 2 }, 'r2');

      await expect(
        manager.counter(initial.negotiationId, 'bender', { v: 3 }, 'r3'),
      ).rejects.toThrow('Maximum counter rounds (2) reached');
    });
  });

  // ── getNegotiation ──────────────────────────────────────────

  describe('getNegotiation()', () => {
    it('returns the negotiation state', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());

      const state = manager.getNegotiation(initial.negotiationId);
      expect(state).toBeDefined();
      expect(state!.negotiationId).toBe(initial.negotiationId);
    });

    it('returns undefined for unknown negotiationId', () => {
      const { manager } = createNegotiationManager();
      expect(manager.getNegotiation('nonexistent')).toBeUndefined();
    });
  });

  // ── isTerminal ──────────────────────────────────────────────

  describe('isTerminal()', () => {
    it('returns false for active negotiation', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());
      expect(manager.isTerminal(initial.negotiationId)).toBe(false);
    });

    it('returns true for accepted negotiation', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());
      await manager.accept(initial.negotiationId, 'bender');
      expect(manager.isTerminal(initial.negotiationId)).toBe(true);
    });

    it('returns true for unknown negotiation (treated as terminal)', () => {
      const { manager } = createNegotiationManager();
      expect(manager.isTerminal('nonexistent')).toBe(true);
    });
  });

  // ── getLatestProposal ───────────────────────────────────────

  describe('getLatestProposal()', () => {
    it('returns the last propose/counter turn', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());
      await manager.counter(initial.negotiationId, 'bender', { v: 1 }, 'counter 1');

      const latest = manager.getLatestProposal(initial.negotiationId);
      expect(latest).toBeDefined();
      expect(latest!.phase).toBe('counter');
      expect(latest!.agentId).toBe('bender');
    });

    it('returns the propose turn when no counters exist', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());

      const latest = manager.getLatestProposal(initial.negotiationId);
      expect(latest!.phase).toBe('propose');
    });

    it('skips terminal turns and returns the last propose/counter', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());
      await manager.counter(initial.negotiationId, 'bender', { v: 1 }, 'c1');
      await manager.accept(initial.negotiationId, 'leela');

      const latest = manager.getLatestProposal(initial.negotiationId);
      expect(latest!.phase).toBe('counter');
    });

    it('returns undefined for unknown negotiation', () => {
      const { manager } = createNegotiationManager();
      expect(manager.getLatestProposal('nonexistent')).toBeUndefined();
    });
  });

  // ── getActiveNegotiations ───────────────────────────────────

  describe('getActiveNegotiations()', () => {
    it('excludes terminal negotiations', async () => {
      const { manager } = createNegotiationManager();
      const n1 = await manager.propose(baseProposal({ subject: 'n1' }));
      await manager.propose(baseProposal({ subject: 'n2' }));
      await manager.accept(n1.negotiationId, 'bender');

      const active = manager.getActiveNegotiations();
      expect(active).toHaveLength(1);
      expect(active[0]!.subject).toBe('n2');
    });
  });

  // ── remove ──────────────────────────────────────────────────

  describe('remove()', () => {
    it('deletes a negotiation', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal());

      expect(manager.remove(initial.negotiationId)).toBe(true);
      expect(manager.getNegotiation(initial.negotiationId)).toBeUndefined();
    });

    it('returns false for unknown negotiation', () => {
      const { manager } = createNegotiationManager();
      expect(manager.remove('nonexistent')).toBe(false);
    });
  });

  // ── Negotiation with claimScore ─────────────────────────────

  describe('negotiation with claimScore', () => {
    it('propagates claimScore through propose and counter', async () => {
      const { manager } = createNegotiationManager();
      const initial = await manager.propose(baseProposal({ claimScore: 0.7 }));

      expect(initial.history[0]!.message.payload.claimScore).toBe(0.7);

      const countered = await manager.counter(
        initial.negotiationId,
        'bender',
        { scope: 'revised' },
        'Higher priority',
        0.9,
      );

      expect(countered.history[1]!.message.payload.claimScore).toBe(0.9);
    });
  });
});
