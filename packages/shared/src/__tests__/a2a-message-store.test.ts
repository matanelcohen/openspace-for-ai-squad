import { beforeEach,describe, expect, it } from 'vitest';

import { A2AMessageStore } from '../a2a/message-store.js';
import type {
  A2ALifecycleEvent,
  A2AMessage,
  A2AMessagePriority,
  A2AMessageStatus,
  A2AMessageType,
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
    priority: 'normal' as A2AMessagePriority,
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

function makeLifecycleEvent(
  messageId: string,
  overrides: Partial<A2ALifecycleEvent> = {},
): A2ALifecycleEvent {
  return {
    messageId,
    previousStatus: null,
    newStatus: 'sent',
    timestamp: new Date().toISOString(),
    actor: 'agent-a',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('A2AMessageStore', () => {
  let store: A2AMessageStore;

  beforeEach(() => {
    store = new A2AMessageStore();
    counter = 0;
  });

  // ── save / get ────────────────────────────────────────────────

  it('save() and get() round-trip a message', () => {
    const msg = makeMessage({ id: 'x1' });
    store.save(msg);
    expect(store.get('x1')).toBe(msg);
  });

  it('save() updates an existing message with the same id', () => {
    const msg = makeMessage({ id: 'x1', status: 'sent' as A2AMessageStatus });
    store.save(msg);

    const updated = { ...msg, status: 'received' as A2AMessageStatus };
    store.save(updated);

    expect(store.get('x1')?.status).toBe('received');
    expect(store.size).toBe(1);
  });

  it('get() returns undefined for unknown id', () => {
    expect(store.get('nonexistent')).toBeUndefined();
  });

  // ── delete ────────────────────────────────────────────────────

  it('delete() removes message, lifecycle events, and correlation index entries', () => {
    const msg = makeMessage({ id: 'd1', correlationId: 'c-del' });
    store.save(msg);
    store.addLifecycleEvent(makeLifecycleEvent('d1'));

    expect(store.delete('d1')).toBe(true);
    expect(store.get('d1')).toBeUndefined();
    expect(store.getLifecycle('d1')).toEqual([]);
    expect(store.getByCorrelation('c-del')).toEqual([]);
    expect(store.getCorrelationIds()).not.toContain('c-del');
  });

  it('delete() returns false for unknown id', () => {
    expect(store.delete('ghost')).toBe(false);
  });

  it('delete() only removes the target message from a shared correlation group', () => {
    const m1 = makeMessage({ id: 'g1', correlationId: 'shared' });
    const m2 = makeMessage({ id: 'g2', correlationId: 'shared' });
    store.save(m1);
    store.save(m2);

    store.delete('g1');

    expect(store.getByCorrelation('shared')).toHaveLength(1);
    expect(store.getByCorrelation('shared')[0].id).toBe('g2');
    expect(store.getCorrelationIds()).toContain('shared');
  });

  // ── getByCorrelation ──────────────────────────────────────────

  it('getByCorrelation() returns messages sorted by createdAt', () => {
    const older = makeMessage({
      id: 'old',
      correlationId: 'sorted',
      createdAt: '2024-01-01T00:00:00.000Z',
    });
    const newer = makeMessage({
      id: 'new',
      correlationId: 'sorted',
      createdAt: '2024-01-02T00:00:00.000Z',
    });

    // Insert newer first to verify sorting
    store.save(newer);
    store.save(older);

    const result = store.getByCorrelation('sorted');
    expect(result.map((m) => m.id)).toEqual(['old', 'new']);
  });

  it('getByCorrelation() returns empty array for unknown correlationId', () => {
    expect(store.getByCorrelation('unknown')).toEqual([]);
  });

  // ── addLifecycleEvent / getLifecycle ──────────────────────────

  it('addLifecycleEvent() and getLifecycle() store and retrieve events', () => {
    const e1 = makeLifecycleEvent('m1', { newStatus: 'sent' });
    const e2 = makeLifecycleEvent('m1', {
      previousStatus: 'sent',
      newStatus: 'received',
    });

    store.addLifecycleEvent(e1);
    store.addLifecycleEvent(e2);

    const events = store.getLifecycle('m1');
    expect(events).toHaveLength(2);
    expect(events[0].newStatus).toBe('sent');
    expect(events[1].newStatus).toBe('received');
  });

  it('getLifecycle() returns empty array for unknown message', () => {
    expect(store.getLifecycle('missing')).toEqual([]);
  });

  // ── query ─────────────────────────────────────────────────────

  it('query() filters by sender', () => {
    store.save(makeMessage({ id: 'q1', sender: 'alice' }));
    store.save(makeMessage({ id: 'q2', sender: 'bob' }));

    expect(store.query({ sender: 'alice' })).toHaveLength(1);
    expect(store.query({ sender: 'alice' })[0].id).toBe('q1');
  });

  it('query() filters by recipient', () => {
    store.save(makeMessage({ id: 'q1', recipient: 'alice' }));
    store.save(makeMessage({ id: 'q2', recipient: 'bob' }));

    expect(store.query({ recipient: 'bob' })).toHaveLength(1);
  });

  it('query() filters by type', () => {
    store.save(makeMessage({ id: 'q1', type: 'delegation_request' as A2AMessageType }));
    store.save(
      makeMessage({
        id: 'q2',
        type: 'delegation_response' as A2AMessageType,
        payload: { outcome: 'accepted' },
      }),
    );

    expect(store.query({ type: 'delegation_request' })).toHaveLength(1);
  });

  it('query() filters by status', () => {
    store.save(makeMessage({ id: 'q1', status: 'sent' as A2AMessageStatus }));
    store.save(makeMessage({ id: 'q2', status: 'completed' as A2AMessageStatus }));

    expect(store.query({ status: 'completed' })).toHaveLength(1);
  });

  it('query() ANDs multiple filters', () => {
    store.save(makeMessage({ id: 'q1', sender: 'alice', status: 'sent' as A2AMessageStatus }));
    store.save(
      makeMessage({ id: 'q2', sender: 'alice', status: 'completed' as A2AMessageStatus }),
    );
    store.save(makeMessage({ id: 'q3', sender: 'bob', status: 'sent' as A2AMessageStatus }));

    expect(store.query({ sender: 'alice', status: 'sent' })).toHaveLength(1);
  });

  it('query() with correlationId uses fast path', () => {
    store.save(makeMessage({ id: 'f1', correlationId: 'fast', sender: 'a' }));
    store.save(makeMessage({ id: 'f2', correlationId: 'fast', sender: 'b' }));
    store.save(makeMessage({ id: 'f3', correlationId: 'other', sender: 'a' }));

    const result = store.query({ correlationId: 'fast', sender: 'a' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('f1');
  });

  // ── getCorrelationIds ─────────────────────────────────────────

  it('getCorrelationIds() returns all correlation IDs', () => {
    store.save(makeMessage({ id: 'c1', correlationId: 'alpha' }));
    store.save(makeMessage({ id: 'c2', correlationId: 'beta' }));
    store.save(makeMessage({ id: 'c3', correlationId: 'alpha' }));

    const ids = store.getCorrelationIds();
    expect(ids).toHaveLength(2);
    expect(ids).toContain('alpha');
    expect(ids).toContain('beta');
  });

  // ── size ──────────────────────────────────────────────────────

  it('size reflects message count', () => {
    expect(store.size).toBe(0);
    store.save(makeMessage({ id: 's1' }));
    expect(store.size).toBe(1);
    store.save(makeMessage({ id: 's2' }));
    expect(store.size).toBe(2);
    store.delete('s1');
    expect(store.size).toBe(1);
  });

  // ── clear ─────────────────────────────────────────────────────

  it('clear() removes all messages, lifecycle events, and correlation index', () => {
    store.save(makeMessage({ id: 'cl1', correlationId: 'cx' }));
    store.save(makeMessage({ id: 'cl2', correlationId: 'cy' }));
    store.addLifecycleEvent(makeLifecycleEvent('cl1'));

    store.clear();

    expect(store.size).toBe(0);
    expect(store.getCorrelationIds()).toEqual([]);
    expect(store.getLifecycle('cl1')).toEqual([]);
    expect(store.getByCorrelation('cx')).toEqual([]);
  });
});
