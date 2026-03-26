/**
 * In-memory store for A2A messages and lifecycle events.
 *
 * Indexed by message ID and correlationId for fast lookups.
 * Provides the persistence layer that the message bus and other
 * components build on top of.
 */

import type {
  A2ALifecycleEvent,
  A2AMessage,
  A2AMessageStatus,
  A2AMessageType,
} from '../types/a2a.js';

// ── Query helpers ────────────────────────────────────────────────

export interface MessageQuery {
  correlationId?: string;
  sender?: string;
  recipient?: string;
  type?: A2AMessageType;
  status?: A2AMessageStatus;
}

// ── Store ────────────────────────────────────────────────────────

export class A2AMessageStore {
  /** Primary index: messageId → message */
  private readonly messages = new Map<string, A2AMessage>();

  /** Secondary index: correlationId → set of messageIds */
  private readonly byCorrelation = new Map<string, Set<string>>();

  /** Lifecycle history per message */
  private readonly lifecycle = new Map<string, A2ALifecycleEvent[]>();

  // ── Write operations ─────────────────────────────────────────

  /** Store or update a message. Automatically maintains correlation index. */
  save(message: A2AMessage): void {
    this.messages.set(message.id, message);

    let group = this.byCorrelation.get(message.correlationId);
    if (!group) {
      group = new Set();
      this.byCorrelation.set(message.correlationId, group);
    }
    group.add(message.id);
  }

  /** Append a lifecycle event for a message. */
  addLifecycleEvent(event: A2ALifecycleEvent): void {
    let events = this.lifecycle.get(event.messageId);
    if (!events) {
      events = [];
      this.lifecycle.set(event.messageId, events);
    }
    events.push(event);
  }

  /** Remove a message and its lifecycle events from the store. */
  delete(messageId: string): boolean {
    const msg = this.messages.get(messageId);
    if (!msg) return false;

    this.messages.delete(messageId);
    this.lifecycle.delete(messageId);

    const group = this.byCorrelation.get(msg.correlationId);
    if (group) {
      group.delete(messageId);
      if (group.size === 0) this.byCorrelation.delete(msg.correlationId);
    }

    return true;
  }

  // ── Read operations ──────────────────────────────────────────

  /** Get a single message by ID. */
  get(messageId: string): A2AMessage | undefined {
    return this.messages.get(messageId);
  }

  /** Get all messages in a correlation group, ordered by createdAt. */
  getByCorrelation(correlationId: string): A2AMessage[] {
    const ids = this.byCorrelation.get(correlationId);
    if (!ids) return [];

    const result: A2AMessage[] = [];
    for (const id of ids) {
      const msg = this.messages.get(id);
      if (msg) result.push(msg);
    }
    return result.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }

  /** Get lifecycle events for a message. */
  getLifecycle(messageId: string): A2ALifecycleEvent[] {
    return this.lifecycle.get(messageId) ?? [];
  }

  /** Query messages by filter criteria. All filters are AND-ed. */
  query(filter: MessageQuery): A2AMessage[] {
    // Fast path: if correlationId is specified, start from that index
    const candidates = filter.correlationId
      ? this.getByCorrelation(filter.correlationId)
      : Array.from(this.messages.values());

    return candidates.filter((msg) => {
      if (filter.sender && msg.sender !== filter.sender) return false;
      if (filter.recipient && msg.recipient !== filter.recipient) return false;
      if (filter.type && msg.type !== filter.type) return false;
      if (filter.status && msg.status !== filter.status) return false;
      return true;
    });
  }

  /** Get all correlation IDs in the store. */
  getCorrelationIds(): string[] {
    return Array.from(this.byCorrelation.keys());
  }

  /** Total number of stored messages. */
  get size(): number {
    return this.messages.size;
  }

  /** Remove all messages and lifecycle events. */
  clear(): void {
    this.messages.clear();
    this.byCorrelation.clear();
    this.lifecycle.clear();
  }
}
