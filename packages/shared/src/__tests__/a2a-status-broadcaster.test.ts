import { beforeEach,describe, expect, it, vi } from 'vitest';

import type { A2ABusEvent, A2ABusEventType } from '../a2a/status-broadcaster.js';
import { StatusBroadcaster } from '../a2a/status-broadcaster.js';
import type { A2AMessage, A2AMessageStatus } from '../types/a2a.js';

// ── Helpers ─────────────────────────────────────────────────────

function makeMessage(overrides: Partial<A2AMessage> = {}): A2AMessage {
  const now = new Date().toISOString();
  return {
    id: 'msg-1',
    correlationId: 'corr-1',
    type: 'delegation_request',
    sender: 'agent-a',
    recipient: 'agent-b',
    routing: { strategy: 'direct', target: 'agent-b' },
    priority: 'normal',
    status: 'sent',
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

function makeEvent(overrides: Partial<A2ABusEvent> = {}): A2ABusEvent {
  return {
    type: 'message:sent',
    message: makeMessage(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('StatusBroadcaster', () => {
  let broadcaster: StatusBroadcaster;

  beforeEach(() => {
    broadcaster = new StatusBroadcaster();
  });

  // ── on / emit ─────────────────────────────────────────────────

  it('typed listener receives matching events', () => {
    const listener = vi.fn();
    broadcaster.on('message:sent', listener);

    const event = makeEvent({ type: 'message:sent' });
    broadcaster.emit(event);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);
  });

  it('typed listener does NOT receive non-matching events', () => {
    const listener = vi.fn();
    broadcaster.on('message:sent', listener);

    broadcaster.emit(makeEvent({ type: 'message:acknowledged' }));

    expect(listener).not.toHaveBeenCalled();
  });

  it('wildcard listener receives all events', () => {
    const listener = vi.fn();
    broadcaster.on('*', listener);

    broadcaster.emit(makeEvent({ type: 'message:sent' }));
    broadcaster.emit(makeEvent({ type: 'delegation:requested' }));
    broadcaster.emit(makeEvent({ type: 'status:updated' }));

    expect(listener).toHaveBeenCalledTimes(3);
  });

  it('on() returns unsubscribe function that removes the listener', () => {
    const listener = vi.fn();
    const unsub = broadcaster.on('message:sent', listener);

    broadcaster.emit(makeEvent({ type: 'message:sent' }));
    expect(listener).toHaveBeenCalledOnce();

    unsub();

    broadcaster.emit(makeEvent({ type: 'message:sent' }));
    expect(listener).toHaveBeenCalledOnce(); // still 1
  });

  it('wildcard unsubscribe works', () => {
    const listener = vi.fn();
    const unsub = broadcaster.on('*', listener);

    unsub();

    broadcaster.emit(makeEvent({ type: 'message:sent' }));
    expect(listener).not.toHaveBeenCalled();
  });

  it('multiple listeners on the same event type all fire', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    broadcaster.on('message:sent', l1);
    broadcaster.on('message:sent', l2);

    broadcaster.emit(makeEvent({ type: 'message:sent' }));

    expect(l1).toHaveBeenCalledOnce();
    expect(l2).toHaveBeenCalledOnce();
  });

  // ── emitStatusUpdate ──────────────────────────────────────────

  it('emitStatusUpdate() emits a status:updated event with payload data', () => {
    const listener = vi.fn();
    broadcaster.on('status:updated', listener);

    const msg = makeMessage({
      type: 'status_update',
      payload: {
        taskId: 't-42',
        status: 'in_progress',
        description: 'halfway',
        progressPercent: 50,
      },
    } as Partial<A2AMessage>);

    broadcaster.emitStatusUpdate(msg);

    expect(listener).toHaveBeenCalledOnce();
    const event: A2ABusEvent = listener.mock.calls[0][0];
    expect(event.type).toBe('status:updated');
    expect(event.data).toMatchObject({
      taskId: 't-42',
      status: 'in_progress',
      progressPercent: 50,
      description: 'halfway',
    });
  });

  // ── emitStatusChange ──────────────────────────────────────────

  it('emitStatusChange() emits a message:status_changed event', () => {
    const listener = vi.fn();
    broadcaster.on('message:status_changed', listener);

    const msg = makeMessage({ status: 'received' as A2AMessageStatus });
    broadcaster.emitStatusChange(msg, 'sent');

    expect(listener).toHaveBeenCalledOnce();
    const event: A2ABusEvent = listener.mock.calls[0][0];
    expect(event.type).toBe('message:status_changed');
    expect(event.previousStatus).toBe('sent');
    expect(event.message.status).toBe('received');
  });

  // ── error swallowing ──────────────────────────────────────────

  it('error in a listener is swallowed and does not break other listeners', () => {
    const badListener = vi.fn(() => {
      throw new Error('boom');
    });
    const goodListener = vi.fn();

    broadcaster.on('message:sent', badListener);
    broadcaster.on('message:sent', goodListener);

    // Should not throw
    expect(() => broadcaster.emit(makeEvent({ type: 'message:sent' }))).not.toThrow();
    expect(goodListener).toHaveBeenCalledOnce();
  });

  it('error in wildcard listener does not break typed listeners', () => {
    const badWild = vi.fn(() => {
      throw new Error('wildcard boom');
    });
    const goodTyped = vi.fn();

    broadcaster.on('*', badWild);
    broadcaster.on('message:sent', goodTyped);

    expect(() => broadcaster.emit(makeEvent({ type: 'message:sent' }))).not.toThrow();
    expect(goodTyped).toHaveBeenCalledOnce();
  });

  // ── clear ─────────────────────────────────────────────────────

  it('clear() removes all listeners', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    broadcaster.on('message:sent', l1);
    broadcaster.on('*', l2);

    broadcaster.clear();

    broadcaster.emit(makeEvent({ type: 'message:sent' }));
    expect(l1).not.toHaveBeenCalled();
    expect(l2).not.toHaveBeenCalled();
  });

  // ── listenerCount ─────────────────────────────────────────────

  it('listenerCount reflects typed + wildcard listeners', () => {
    expect(broadcaster.listenerCount).toBe(0);

    broadcaster.on('message:sent', vi.fn());
    expect(broadcaster.listenerCount).toBe(1);

    broadcaster.on('message:sent', vi.fn());
    expect(broadcaster.listenerCount).toBe(2);

    broadcaster.on('*', vi.fn());
    expect(broadcaster.listenerCount).toBe(3);

    broadcaster.on('delegation:requested', vi.fn());
    expect(broadcaster.listenerCount).toBe(4);
  });

  it('listenerCount decreases after unsubscribe', () => {
    const unsub = broadcaster.on('message:sent', vi.fn());
    expect(broadcaster.listenerCount).toBe(1);

    unsub();
    expect(broadcaster.listenerCount).toBe(0);
  });
});
