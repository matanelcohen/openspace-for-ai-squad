import { beforeEach, describe, expect, it } from 'vitest';

import type { InterruptResolution, InterruptState } from '../types/interrupt.js';
import { InMemoryInterruptStore } from '../workflow/interrupt-store.js';

// ── Fixtures ────────────────────────────────────────────────────

function makeInterrupt(overrides?: Partial<InterruptState>): InterruptState {
  return {
    id: 'int-1',
    executionId: 'exec-1',
    nodeId: 'node-1',
    status: 'pending',
    request: {
      reason: 'low_confidence',
      message: 'Need human review',
      confidenceScore: 0.3,
      proposedAction: 'deploy',
    },
    createdAt: '2026-01-01T00:00:00.000Z',
    timeoutAt: null,
    escalationId: null,
    resolution: null,
    timeoutPolicy: null,
    ...overrides,
  } as InterruptState;
}

// ── Tests ────────────────────────────────────────────────────────

describe('InMemoryInterruptStore', () => {
  let store: InMemoryInterruptStore;

  beforeEach(() => {
    store = new InMemoryInterruptStore();
  });

  // ── save & load ──────────────────────────────────────────

  describe('save and load', () => {
    it('saves and loads an interrupt', async () => {
      const interrupt = makeInterrupt();
      await store.save(interrupt);

      const loaded = await store.load('int-1');
      expect(loaded).not.toBeNull();
      expect(loaded!.id).toBe('int-1');
      expect(loaded!.status).toBe('pending');
    });

    it('returns null for nonexistent interrupt', async () => {
      const loaded = await store.load('nonexistent');
      expect(loaded).toBeNull();
    });

    it('stores a copy (mutations dont affect stored state)', async () => {
      const interrupt = makeInterrupt();
      await store.save(interrupt);

      interrupt.status = 'resolved';
      const loaded = await store.load('int-1');
      expect(loaded!.status).toBe('pending');
    });

    it('overwrites existing interrupt with same ID', async () => {
      await store.save(makeInterrupt());
      await store.save(makeInterrupt({ id: 'int-1', status: 'claimed' }));

      const loaded = await store.load('int-1');
      expect(loaded!.status).toBe('claimed');
      expect(store.size).toBe(1);
    });
  });

  // ── loadByExecution ──────────────────────────────────────

  describe('loadByExecution', () => {
    it('returns pending and claimed interrupts for execution', async () => {
      await store.save(makeInterrupt({ id: 'int-1', executionId: 'exec-1', status: 'pending' }));
      await store.save(makeInterrupt({ id: 'int-2', executionId: 'exec-1', status: 'claimed' }));
      await store.save(makeInterrupt({ id: 'int-3', executionId: 'exec-1', status: 'resolved' }));
      await store.save(makeInterrupt({ id: 'int-4', executionId: 'exec-2', status: 'pending' }));

      const results = await store.loadByExecution('exec-1');
      expect(results.length).toBe(2);
      expect(results.map((r) => r.id).sort()).toEqual(['int-1', 'int-2']);
    });

    it('returns empty for unknown execution', async () => {
      const results = await store.loadByExecution('nonexistent');
      expect(results).toEqual([]);
    });
  });

  // ── loadByNode ───────────────────────────────────────────

  describe('loadByNode', () => {
    it('returns active interrupt for specific node', async () => {
      await store.save(makeInterrupt({ id: 'int-1', executionId: 'exec-1', nodeId: 'node-1' }));
      await store.save(makeInterrupt({ id: 'int-2', executionId: 'exec-1', nodeId: 'node-2' }));

      const result = await store.loadByNode('exec-1', 'node-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('int-1');
    });

    it('returns null for resolved interrupt at node', async () => {
      await store.save(
        makeInterrupt({
          id: 'int-1',
          executionId: 'exec-1',
          nodeId: 'node-1',
          status: 'resolved',
        }),
      );

      const result = await store.loadByNode('exec-1', 'node-1');
      expect(result).toBeNull();
    });

    it('returns null for nonexistent node', async () => {
      const result = await store.loadByNode('exec-1', 'nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── resolve ──────────────────────────────────────────────

  describe('resolve', () => {
    it('resolves a pending interrupt', async () => {
      await store.save(makeInterrupt());

      const resolution: InterruptResolution = {
        action: 'approve',
        reviewerId: 'reviewer-1',
        comment: 'Looks good',
        resolvedAt: new Date().toISOString(),
      };

      const resolved = await store.resolve('int-1', resolution);
      expect(resolved.status).toBe('resolved');
      expect(resolved.resolution).toEqual(resolution);
    });

    it('throws for nonexistent interrupt', async () => {
      const resolution: InterruptResolution = {
        action: 'approve',
        reviewerId: 'reviewer-1',
        resolvedAt: new Date().toISOString(),
      };

      await expect(store.resolve('nonexistent', resolution)).rejects.toThrow('not found');
    });

    it('throws for already resolved interrupt', async () => {
      await store.save(makeInterrupt({ id: 'int-1', status: 'resolved' }));

      const resolution: InterruptResolution = {
        action: 'approve',
        reviewerId: 'reviewer-1',
        resolvedAt: new Date().toISOString(),
      };

      await expect(store.resolve('int-1', resolution)).rejects.toThrow('already resolved');
    });

    it('throws for auto_resolved interrupt', async () => {
      await store.save(makeInterrupt({ id: 'int-1', status: 'auto_resolved' }));

      const resolution: InterruptResolution = {
        action: 'approve',
        reviewerId: 'reviewer-1',
        resolvedAt: new Date().toISOString(),
      };

      await expect(store.resolve('int-1', resolution)).rejects.toThrow('already resolved');
    });

    it('persists resolved state', async () => {
      await store.save(makeInterrupt());

      const resolution: InterruptResolution = {
        action: 'reject',
        reviewerId: 'reviewer-1',
        comment: 'Too risky',
        resolvedAt: new Date().toISOString(),
      };

      await store.resolve('int-1', resolution);

      const loaded = await store.load('int-1');
      expect(loaded!.status).toBe('resolved');
      expect(loaded!.resolution).toEqual(resolution);
    });
  });

  // ── findTimedOut ─────────────────────────────────────────

  describe('findTimedOut', () => {
    it('finds interrupts past their timeout', async () => {
      await store.save(
        makeInterrupt({
          id: 'int-1',
          timeoutAt: '2026-01-01T01:00:00.000Z',
        }),
      );
      await store.save(
        makeInterrupt({
          id: 'int-2',
          timeoutAt: '2026-01-01T03:00:00.000Z',
        }),
      );

      const timedOut = await store.findTimedOut('2026-01-01T02:00:00.000Z');
      expect(timedOut.length).toBe(1);
      expect(timedOut[0]!.id).toBe('int-1');
    });

    it('returns empty when no interrupts timed out', async () => {
      await store.save(
        makeInterrupt({
          id: 'int-1',
          timeoutAt: '2026-12-31T23:59:59.000Z',
        }),
      );

      const timedOut = await store.findTimedOut('2026-01-01T00:00:00.000Z');
      expect(timedOut).toEqual([]);
    });

    it('ignores interrupts with null timeout', async () => {
      await store.save(
        makeInterrupt({
          id: 'int-1',
          timeoutAt: null,
        }),
      );

      const timedOut = await store.findTimedOut('2099-01-01T00:00:00.000Z');
      expect(timedOut).toEqual([]);
    });

    it('ignores resolved interrupts', async () => {
      await store.save(
        makeInterrupt({
          id: 'int-1',
          status: 'resolved',
          timeoutAt: '2026-01-01T00:00:00.000Z',
        }),
      );

      const timedOut = await store.findTimedOut('2026-01-02T00:00:00.000Z');
      expect(timedOut).toEqual([]);
    });

    it('includes claimed interrupts that timed out', async () => {
      await store.save(
        makeInterrupt({
          id: 'int-1',
          status: 'claimed',
          timeoutAt: '2026-01-01T00:00:00.000Z',
        }),
      );

      const timedOut = await store.findTimedOut('2026-01-02T00:00:00.000Z');
      expect(timedOut.length).toBe(1);
    });
  });

  // ── deleteByExecution ────────────────────────────────────

  describe('deleteByExecution', () => {
    it('deletes all interrupts for an execution', async () => {
      await store.save(makeInterrupt({ id: 'int-1', executionId: 'exec-1' }));
      await store.save(makeInterrupt({ id: 'int-2', executionId: 'exec-1' }));
      await store.save(makeInterrupt({ id: 'int-3', executionId: 'exec-2' }));

      await store.deleteByExecution('exec-1');

      expect(store.size).toBe(1);
      expect(await store.load('int-3')).not.toBeNull();
      expect(await store.load('int-1')).toBeNull();
    });

    it('is no-op for unknown execution', async () => {
      await store.save(makeInterrupt());
      await store.deleteByExecution('nonexistent');
      expect(store.size).toBe(1);
    });
  });

  // ── clear & size ─────────────────────────────────────────

  describe('clear and size', () => {
    it('clears all interrupts', async () => {
      await store.save(makeInterrupt({ id: 'int-1' }));
      await store.save(makeInterrupt({ id: 'int-2' }));
      expect(store.size).toBe(2);

      store.clear();
      expect(store.size).toBe(0);
    });

    it('size reflects stored count', async () => {
      expect(store.size).toBe(0);
      await store.save(makeInterrupt({ id: 'a' }));
      expect(store.size).toBe(1);
      await store.save(makeInterrupt({ id: 'b' }));
      expect(store.size).toBe(2);
    });
  });
});
