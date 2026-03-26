/**
 * Handoff mechanism — transfers full ownership of a sub-task from one
 * agent to another, preserving work state and artifacts.
 *
 * Differs from delegation: delegation is "do this for me and report back",
 * while handoff is "this is yours now, I'm done with it".
 */

import type {
  A2AArtifact,
  A2AHandoff,
  A2AHandoffPayload,
  A2AHandoffReason,
  A2AMessagePriority,
  A2ARoutingInfo,
} from '../types/a2a.js';
import { A2A_DEFAULT_RETRY_POLICY, A2A_PROTOCOL_VERSION } from '../types/a2a.js';

import type { CorrelationTracker } from './correlation-tracker.js';
import type { A2AMessageBus } from './message-bus.js';
import type { StatusBroadcaster } from './status-broadcaster.js';

// ── Types ────────────────────────────────────────────────────────

export interface HandoffRequest {
  /** Agent handing off the work. */
  fromAgentId: string;
  /** Routing for the new owner. */
  routing: A2ARoutingInfo;
  /** Task ID being handed off. */
  taskId: string;
  /** Reason for the handoff. */
  reason: A2AHandoffReason;
  /** Detailed explanation. */
  description: string;
  /** Current state of the work. */
  workState: Record<string, unknown>;
  /** Artifacts produced before handoff. */
  artifacts?: A2AArtifact[];
  /** Suggested next steps. */
  suggestedNextSteps?: string[];
  /** Suggested target agent (hint for the router). */
  suggestedTarget?: string;
  /** Priority. */
  priority?: A2AMessagePriority;
  /** Optional correlation ID to link to an existing delegation chain. */
  correlationId?: string;
}

export interface HandoffResult {
  /** The handoff message that was sent. */
  handoffMessage: A2AHandoff;
  /** Correlation ID. */
  correlationId: string;
  /** Resolved recipient agent IDs. */
  recipientIds: string[];
}

/** Tracks a pending handoff awaiting acknowledgment. */
export interface PendingHandoff {
  handoffMessage: A2AHandoff;
  fromAgentId: string;
  taskId: string;
  /** ISO-8601 timestamp when the handoff was initiated. */
  initiatedAt: string;
  /** Whether the handoff has been acknowledged by the new owner. */
  acknowledged: boolean;
  /** Agent who acknowledged (if any). */
  acknowledgedBy?: string;
}

// ── Handoff Manager ──────────────────────────────────────────────

export interface HandoffManagerOptions {
  messageBus: A2AMessageBus;
  correlationTracker?: CorrelationTracker;
  broadcaster?: StatusBroadcaster;
  generateId?: (prefix: string) => string;
}

let idCounter = 0;

function defaultGenerateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

export class HandoffManager {
  private readonly bus: A2AMessageBus;
  private readonly tracker?: CorrelationTracker;
  private readonly broadcaster?: StatusBroadcaster;
  private readonly generateId: (prefix: string) => string;

  /** Pending handoffs indexed by handoff message ID. */
  private readonly pending = new Map<string, PendingHandoff>();

  constructor(opts: HandoffManagerOptions) {
    this.bus = opts.messageBus;
    this.tracker = opts.correlationTracker;
    this.broadcaster = opts.broadcaster;
    this.generateId = opts.generateId ?? defaultGenerateId;
  }

  // ── Initiate Handoff ─────────────────────────────────────────

  /**
   * Hand off a task to another agent. The receiving agent becomes
   * the full owner — the original agent is no longer responsible.
   */
  async handoff(request: HandoffRequest): Promise<HandoffResult> {
    const messageId = this.generateId('a2a-hoff');
    const correlationId = request.correlationId ?? this.generateId('corr');
    const now = new Date().toISOString();
    const ttlMs = A2A_DEFAULT_RETRY_POLICY.ttlMs;

    const payload: A2AHandoffPayload = {
      taskId: request.taskId,
      reason: request.reason,
      description: request.description,
      workState: request.workState,
      artifacts: request.artifacts,
      suggestedNextSteps: request.suggestedNextSteps,
      suggestedTarget: request.suggestedTarget,
    };

    const message: A2AHandoff = {
      id: messageId,
      correlationId,
      type: 'handoff',
      sender: request.fromAgentId,
      recipient: request.routing.target,
      routing: request.routing,
      priority: request.priority ?? 'normal',
      status: 'sent',
      payload,
      retryPolicy: A2A_DEFAULT_RETRY_POLICY,
      attemptCount: 1,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      protocolVersion: A2A_PROTOCOL_VERSION,
    };

    // Track as pending
    this.pending.set(messageId, {
      handoffMessage: message,
      fromAgentId: request.fromAgentId,
      taskId: request.taskId,
      initiatedAt: now,
      acknowledged: false,
    });

    // Resolve recipients and send
    const recipientIds = await this.bus.resolveRecipients(request.routing);
    await this.bus.send(message);

    // Update correlation tracker if present
    if (this.tracker && request.correlationId) {
      this.tracker.updateSubTask(correlationId, messageId, {
        status: 'in_progress',
      });
    }

    this.broadcaster?.emit({
      type: 'handoff:initiated',
      message,
      data: {
        taskId: request.taskId,
        reason: request.reason,
        recipientIds,
      },
      timestamp: now,
    });

    return { handoffMessage: message, correlationId, recipientIds };
  }

  // ── Acknowledge Handoff ──────────────────────────────────────

  /**
   * Acknowledge receipt and acceptance of a handoff.
   * The acknowledging agent becomes the new owner of the task.
   */
  async acknowledgeHandoff(
    handoffMessageId: string,
    newOwnerAgentId: string,
  ): Promise<PendingHandoff> {
    const pending = this.pending.get(handoffMessageId);
    if (!pending) {
      throw new Error(`Pending handoff not found: ${handoffMessageId}`);
    }

    if (pending.acknowledged) {
      throw new Error(`Handoff already acknowledged: ${handoffMessageId}`);
    }

    // Acknowledge on the message bus
    await this.bus.acknowledge(handoffMessageId, newOwnerAgentId);

    // Mark as acknowledged
    pending.acknowledged = true;
    pending.acknowledgedBy = newOwnerAgentId;

    // Transition message to processing
    this.bus.markProcessing(handoffMessageId, newOwnerAgentId);

    this.broadcaster?.emit({
      type: 'handoff:completed',
      message: pending.handoffMessage,
      data: {
        taskId: pending.taskId,
        previousOwner: pending.fromAgentId,
        newOwner: newOwnerAgentId,
      },
      timestamp: new Date().toISOString(),
    });

    return pending;
  }

  // ── Queries ──────────────────────────────────────────────────

  /** Get a pending handoff by message ID. */
  getPending(handoffMessageId: string): PendingHandoff | undefined {
    return this.pending.get(handoffMessageId);
  }

  /** Get all pending (unacknowledged) handoffs. */
  getPendingHandoffs(): PendingHandoff[] {
    return Array.from(this.pending.values()).filter((h) => !h.acknowledged);
  }

  /** Get all handoffs for a specific task. */
  getHandoffsForTask(taskId: string): PendingHandoff[] {
    return Array.from(this.pending.values()).filter((h) => h.taskId === taskId);
  }

  /** Remove a handoff from tracking. */
  remove(handoffMessageId: string): boolean {
    return this.pending.delete(handoffMessageId);
  }

  /** Clear all tracked handoffs. */
  clear(): void {
    this.pending.clear();
  }
}
