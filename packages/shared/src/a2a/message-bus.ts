/**
 * A2A Message Bus — implements the A2ARouter interface.
 *
 * Responsibilities:
 * 1. Resolve routing strategies to concrete agent IDs
 * 2. Deliver messages to target agents via registered handlers
 * 3. Manage message lifecycle transitions
 * 4. Handle retries for unacknowledged messages
 * 5. Detect and resolve conflicts
 */

import type {
  A2AConflictResolution,
  A2AConflictResolutionStrategy,
  A2ALifecycleEvent,
  A2AMessage,
  A2AMessageStatus,
  A2ARouter,
  A2ARoutingInfo,
} from '../types/a2a.js';
import type { CorrelationTracker } from './correlation-tracker.js';
import { A2AMessageStore } from './message-store.js';
import type { StatusBroadcaster } from './status-broadcaster.js';

// ── Agent Resolver ───────────────────────────────────────────────

/** Information about an agent needed for routing decisions. */
export interface AgentInfo {
  id: string;
  role: string;
  capabilities: string[];
  currentLoad: number;
}

/**
 * Pluggable agent resolver — the message bus delegates agent lookups
 * to this interface so it stays decoupled from persistence.
 */
export interface AgentResolver {
  /** Get agent info by ID. */
  getAgent(id: string): AgentInfo | undefined;
  /** Get all available agents. */
  getAllAgents(): AgentInfo[];
  /** Get agents matching a role. */
  getAgentsByRole(role: string): AgentInfo[];
  /** Get agents with any of the specified capability tags. */
  getAgentsByCapability(capabilities: string[]): AgentInfo[];
}

/** Handler called when a message is delivered to an agent. */
export type MessageHandler = (message: A2AMessage) => void | Promise<void>;

// ── Message Bus Options ──────────────────────────────────────────

export interface MessageBusOptions {
  agentResolver: AgentResolver;
  broadcaster?: StatusBroadcaster;
  correlationTracker?: CorrelationTracker;
  /** Default conflict resolution strategy. Defaults to 'first_writer_wins'. */
  defaultConflictStrategy?: A2AConflictResolutionStrategy;
}

// ── Valid state transitions ──────────────────────────────────────

const VALID_TRANSITIONS: Record<A2AMessageStatus, A2AMessageStatus[]> = {
  sent: ['received', 'expired', 'cancelled', 'failed'],
  received: ['acknowledged', 'expired', 'cancelled', 'failed'],
  acknowledged: ['processing', 'expired', 'cancelled', 'failed'],
  processing: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: ['sent'], // allow retry
  expired: [],
  cancelled: [],
};

// ── Message Bus ──────────────────────────────────────────────────

export class A2AMessageBus implements A2ARouter {
  private readonly store: A2AMessageStore;
  private readonly resolver: AgentResolver;
  private readonly broadcaster?: StatusBroadcaster;
  private readonly correlationTracker?: CorrelationTracker;
  private readonly defaultConflictStrategy: A2AConflictResolutionStrategy;

  /** Per-agent message handlers */
  private readonly handlers = new Map<string, MessageHandler>();

  /** Round-robin index per routing target */
  private readonly roundRobinIndex = new Map<string, number>();

  constructor(opts: MessageBusOptions) {
    this.store = new A2AMessageStore();
    this.resolver = opts.agentResolver;
    this.broadcaster = opts.broadcaster;
    this.correlationTracker = opts.correlationTracker;
    this.defaultConflictStrategy = opts.defaultConflictStrategy ?? 'first_writer_wins';
  }

  // ── Handler Registration ─────────────────────────────────────

  /** Register a message handler for an agent. */
  registerHandler(agentId: string, handler: MessageHandler): void {
    this.handlers.set(agentId, handler);
  }

  /** Remove a message handler. */
  unregisterHandler(agentId: string): void {
    this.handlers.delete(agentId);
  }

  // ── A2ARouter Implementation ─────────────────────────────────

  async send(message: A2AMessage): Promise<A2ALifecycleEvent> {
    // Store the message
    this.store.save(message);

    // Record initial lifecycle event
    const sendEvent = this.createLifecycleEvent(message.id, null, 'sent', message.sender);
    this.store.addLifecycleEvent(sendEvent);

    // Resolve recipients
    const recipientIds = await this.resolveRecipients(message.routing);

    // Deliver to each recipient
    for (const recipientId of recipientIds) {
      const handler = this.handlers.get(recipientId);
      if (handler) {
        // Transition to received
        this.transitionStatus(message, 'received', recipientId);

        try {
          await handler(message);
        } catch {
          // Handler error — message stays in 'received' state
        }
      }
    }

    // Broadcast the send event
    this.broadcaster?.emit({
      type: 'message:sent',
      message,
      timestamp: new Date().toISOString(),
    });

    return sendEvent;
  }

  async acknowledge(messageId: string, agentId: string): Promise<A2ALifecycleEvent> {
    const message = this.store.get(messageId);
    if (!message) {
      throw new Error(`Message not found: ${messageId}`);
    }

    const event = this.transitionStatus(message, 'acknowledged', agentId);

    this.broadcaster?.emit({
      type: 'message:acknowledged',
      message,
      previousStatus: 'received',
      timestamp: new Date().toISOString(),
    });

    return event;
  }

  async resolveRecipients(routing: A2ARoutingInfo): Promise<string[]> {
    const { strategy, target, excludeAgentIds } = routing;
    const exclude = new Set(excludeAgentIds ?? []);

    let candidates: AgentInfo[];

    switch (strategy) {
      case 'direct': {
        const agent = this.resolver.getAgent(target);
        candidates = agent ? [agent] : [];
        break;
      }
      case 'role_based': {
        candidates = this.resolver.getAgentsByRole(target);
        break;
      }
      case 'capability': {
        const tags = target.split(',').map((t) => t.trim());
        candidates = this.resolver.getAgentsByCapability(tags);
        break;
      }
      case 'broadcast': {
        candidates = this.resolver.getAllAgents();
        break;
      }
      default:
        candidates = [];
    }

    // Filter exclusions
    const filtered = candidates.filter((a) => !exclude.has(a.id));

    // Apply selection strategy for multi-match routing
    if (strategy !== 'broadcast' && strategy !== 'direct' && filtered.length > 1) {
      const selected = this.applySelection(filtered, routing);
      return selected ? [selected.id] : [];
    }

    return filtered.map((a) => a.id);
  }

  async resolveConflicts(
    correlationId: string,
  ): Promise<A2AConflictResolution | null> {
    const messages = this.store.getByCorrelation(correlationId);

    // Find competing delegation responses
    const responses = messages.filter(
      (m) => m.type === 'delegation_response' && m.status !== 'cancelled',
    );

    if (responses.length <= 1) return null;

    const strategy = this.defaultConflictStrategy;

    return this.resolveByStrategy(strategy, responses, correlationId);
  }

  async getConversation(correlationId: string): Promise<A2AMessage[]> {
    return this.store.getByCorrelation(correlationId);
  }

  async getLifecycle(messageId: string): Promise<A2ALifecycleEvent[]> {
    return this.store.getLifecycle(messageId);
  }

  // ── Additional API (beyond A2ARouter) ────────────────────────

  /** Get a message by ID. */
  getMessage(messageId: string): A2AMessage | undefined {
    return this.store.get(messageId);
  }

  /** Transition a message to a new status. */
  transitionStatus(
    message: A2AMessage,
    newStatus: A2AMessageStatus,
    actor: string,
    details?: string,
  ): A2ALifecycleEvent {
    const oldStatus = message.status;

    if (!VALID_TRANSITIONS[oldStatus]?.includes(newStatus)) {
      throw new Error(
        `Invalid status transition: ${oldStatus} → ${newStatus} for message ${message.id}`,
      );
    }

    const previousStatus = message.status;
    message.status = newStatus;
    message.updatedAt = new Date().toISOString();
    this.store.save(message);

    const event = this.createLifecycleEvent(
      message.id,
      previousStatus,
      newStatus,
      actor,
      details,
    );
    this.store.addLifecycleEvent(event);

    this.broadcaster?.emitStatusChange(message, previousStatus);

    return event;
  }

  /** Mark a message as processing. */
  markProcessing(messageId: string, agentId: string): A2ALifecycleEvent {
    const message = this.store.get(messageId);
    if (!message) throw new Error(`Message not found: ${messageId}`);
    return this.transitionStatus(message, 'processing', agentId);
  }

  /** Mark a message as completed. */
  markCompleted(messageId: string, agentId: string): A2ALifecycleEvent {
    const message = this.store.get(messageId);
    if (!message) throw new Error(`Message not found: ${messageId}`);
    return this.transitionStatus(message, 'completed', agentId);
  }

  /** Mark a message as failed. */
  markFailed(messageId: string, agentId: string, reason?: string): A2ALifecycleEvent {
    const message = this.store.get(messageId);
    if (!message) throw new Error(`Message not found: ${messageId}`);
    return this.transitionStatus(message, 'failed', agentId, reason);
  }

  /** Get the underlying message store for direct access. */
  getStore(): A2AMessageStore {
    return this.store;
  }

  // ── Private helpers ──────────────────────────────────────────

  private applySelection(
    candidates: AgentInfo[],
    routing: A2ARoutingInfo,
  ): AgentInfo | undefined {
    const selection = routing.selectionStrategy ?? 'first_available';

    switch (selection) {
      case 'first_available':
        return candidates[0];

      case 'least_loaded':
        return candidates.reduce((min, a) =>
          a.currentLoad < min.currentLoad ? a : min,
        );

      case 'round_robin': {
        const key = `${routing.strategy}:${routing.target}`;
        const idx = this.roundRobinIndex.get(key) ?? 0;
        const selected = candidates[idx % candidates.length];
        this.roundRobinIndex.set(key, idx + 1);
        return selected;
      }

      default:
        return candidates[0];
    }
  }

  private resolveByStrategy(
    strategy: A2AConflictResolutionStrategy,
    responses: A2AMessage[],
    correlationId: string,
  ): A2AConflictResolution {
    let winner: A2AMessage;
    const now = new Date().toISOString();

    switch (strategy) {
      case 'first_writer_wins':
        winner = responses.reduce((earliest, m) =>
          m.createdAt < earliest.createdAt ? m : earliest,
        );
        break;

      case 'priority_based':
        winner = responses.reduce((highest, m) =>
          comparePriority(m.priority, highest.priority) > 0 ? m : highest,
        );
        break;

      case 'claim_score': {
        winner = responses.reduce((best, m) => {
          const mScore =
            m.type === 'negotiation'
              ? ((m.payload as Record<string, unknown>).claimScore as number) ?? 0
              : 0;
          const bestScore =
            best.type === 'negotiation'
              ? ((best.payload as Record<string, unknown>).claimScore as number) ?? 0
              : 0;
          return mScore > bestScore ? m : best;
        });
        break;
      }

      default:
        // lead_decides, merge — fall back to first_writer_wins
        winner = responses.reduce((earliest, m) =>
          m.createdAt < earliest.createdAt ? m : earliest,
        );
    }

    const superseded = responses
      .filter((m) => m.id !== winner.id)
      .map((m) => m.id);

    // Cancel superseded messages
    for (const id of superseded) {
      const msg = this.store.get(id);
      if (msg && VALID_TRANSITIONS[msg.status]?.includes('cancelled')) {
        this.transitionStatus(msg, 'cancelled', 'system', `Superseded by ${winner.id}`);
      }
    }

    return {
      strategy,
      winningMessageId: winner.id,
      supersededMessageIds: superseded,
      explanation: `Resolved via ${strategy}: message ${winner.id} won over ${superseded.length} competing response(s)`,
      resolvedAt: now,
      resolvedBy: 'system',
    };
  }

  private createLifecycleEvent(
    messageId: string,
    previousStatus: A2AMessageStatus | null,
    newStatus: A2AMessageStatus,
    actor: string,
    details?: string,
  ): A2ALifecycleEvent {
    return {
      messageId,
      previousStatus,
      newStatus,
      timestamp: new Date().toISOString(),
      actor,
      details,
    };
  }
}

// ── Priority comparison ──────────────────────────────────────────

const PRIORITY_ORDER = { critical: 4, high: 3, normal: 2, low: 1 } as const;

function comparePriority(a: string, b: string): number {
  const aVal = PRIORITY_ORDER[a as keyof typeof PRIORITY_ORDER] ?? 0;
  const bVal = PRIORITY_ORDER[b as keyof typeof PRIORITY_ORDER] ?? 0;
  return aVal - bVal;
}
