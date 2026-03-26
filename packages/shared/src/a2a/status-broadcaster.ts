/**
 * Status broadcaster — emits progress events to registered listeners.
 *
 * Sits between the message bus and consumers (WebSocket, activity feed, etc.).
 * Tracks the latest status per correlation group and broadcasts diffs.
 */

import type {
  A2AMessage,
  A2AMessageStatus,
  A2AStatusUpdatePayload,
} from '../types/a2a.js';

// ── Event Types ──────────────────────────────────────────────────

export type A2ABusEventType =
  | 'message:sent'
  | 'message:received'
  | 'message:acknowledged'
  | 'message:status_changed'
  | 'delegation:requested'
  | 'delegation:responded'
  | 'delegation:completed'
  | 'status:updated'
  | 'handoff:initiated'
  | 'handoff:completed'
  | 'negotiation:updated'
  | 'correlation:completed';

export interface A2ABusEvent {
  type: A2ABusEventType;
  message: A2AMessage;
  /** Previous status (for status_changed events). */
  previousStatus?: A2AMessageStatus;
  /** Extra data depending on event type. */
  data?: Record<string, unknown>;
  timestamp: string;
}

export type A2ABusEventListener = (event: A2ABusEvent) => void;

// ── Broadcaster ──────────────────────────────────────────────────

export class StatusBroadcaster {
  private readonly listeners = new Map<A2ABusEventType, Set<A2ABusEventListener>>();
  private readonly wildcardListeners = new Set<A2ABusEventListener>();

  /**
   * Subscribe to a specific event type. Returns an unsubscribe function.
   * Pass '*' to receive all events.
   */
  on(type: A2ABusEventType | '*', listener: A2ABusEventListener): () => void {
    if (type === '*') {
      this.wildcardListeners.add(listener);
      return () => {
        this.wildcardListeners.delete(listener);
      };
    }

    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(listener);

    return () => {
      set!.delete(listener);
      if (set!.size === 0) this.listeners.delete(type);
    };
  }

  /** Emit an event to all matching listeners. */
  emit(event: A2ABusEvent): void {
    const typed = this.listeners.get(event.type);
    if (typed) {
      for (const listener of typed) {
        this.safeCall(listener, event);
      }
    }

    for (const listener of this.wildcardListeners) {
      this.safeCall(listener, event);
    }
  }

  /** Convenience: emit a status update event from a status_update message. */
  emitStatusUpdate(message: A2AMessage): void {
    const payload = message.payload as A2AStatusUpdatePayload;
    this.emit({
      type: 'status:updated',
      message,
      data: {
        taskId: payload.taskId,
        status: payload.status,
        progressPercent: payload.progressPercent,
        description: payload.description,
      },
      timestamp: new Date().toISOString(),
    });
  }

  /** Convenience: emit a message lifecycle transition event. */
  emitStatusChange(
    message: A2AMessage,
    previousStatus: A2AMessageStatus,
  ): void {
    this.emit({
      type: 'message:status_changed',
      message,
      previousStatus,
      timestamp: new Date().toISOString(),
    });
  }

  /** Remove all listeners. */
  clear(): void {
    this.listeners.clear();
    this.wildcardListeners.clear();
  }

  /** Number of active listeners (typed + wildcard). */
  get listenerCount(): number {
    let count = this.wildcardListeners.size;
    for (const set of this.listeners.values()) {
      count += set.size;
    }
    return count;
  }

  private safeCall(listener: A2ABusEventListener, event: A2ABusEvent): void {
    try {
      listener(event);
    } catch {
      // Listener errors are swallowed — never break the broadcaster.
    }
  }
}
