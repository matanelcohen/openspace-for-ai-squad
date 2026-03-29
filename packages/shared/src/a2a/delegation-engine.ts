/**
 * Delegation engine — handles work splitting between agents.
 *
 * An agent can request help from another agent, specify the sub-task scope,
 * and receive results back. Results from split work are correlated back to
 * the originating task via the CorrelationTracker.
 */

import type {
  A2AArtifact,
  A2ADelegationOutcome,
  A2ADelegationRequest,
  A2ADelegationRequestPayload,
  A2ADelegationResponse,
  A2ADelegationResponsePayload,
  A2AMessagePriority,
  A2ARetryPolicy,
  A2ARoutingInfo,
  A2AStatusUpdate,
  A2AStatusUpdatePayload,
} from '../types/a2a.js';
import { A2A_DEFAULT_RETRY_POLICY, A2A_PROTOCOL_VERSION } from '../types/a2a.js';
import type { CorrelationStatus, CorrelationTracker } from './correlation-tracker.js';
import type { A2AMessageBus } from './message-bus.js';
import type { StatusBroadcaster } from './status-broadcaster.js';

// ── Types ────────────────────────────────────────────────────────

export interface DelegationRequest {
  /** ID of the delegating agent. */
  fromAgentId: string;
  /** Routing info for the delegate (who should handle the sub-task). */
  routing: A2ARoutingInfo;
  /** Task ID being delegated. */
  taskId: string;
  /** Short summary of the work. */
  summary: string;
  /** Detailed instructions. */
  instructions: string;
  /** Required capabilities (optional). */
  requiredCapabilities?: string[];
  /** Constraints on the work (optional). */
  constraints?: string[];
  /** ISO-8601 deadline (optional). */
  deadline?: string;
  /** Context data passed to the delegate. */
  context?: Record<string, unknown>;
  /** Whether the delegate may further sub-delegate. Defaults to false. */
  allowSubDelegation?: boolean;
  /** Priority of this delegation. Defaults to 'normal'. */
  priority?: A2AMessagePriority;
  /** Custom retry policy (optional). */
  retryPolicy?: A2ARetryPolicy;
}

export interface DelegationResult {
  /** The delegation request message that was sent. */
  requestMessage: A2ADelegationRequest;
  /** Correlation ID for tracking this delegation. */
  correlationId: string;
}

export interface SplitWorkPlan {
  /** ID of the parent task being split. */
  parentTaskId: string;
  /** The agent performing the split. */
  coordinatorAgentId: string;
  /** Sub-task definitions to delegate. */
  subTasks: DelegationRequest[];
  /** Priority for the overall split work. */
  priority?: A2AMessagePriority;
}

export interface SplitWorkResult {
  /** Correlation ID grouping all sub-tasks. */
  correlationId: string;
  /** Individual delegation results. */
  delegations: DelegationResult[];
}

// ── Engine ───────────────────────────────────────────────────────

export interface DelegationEngineOptions {
  messageBus: A2AMessageBus;
  correlationTracker: CorrelationTracker;
  broadcaster?: StatusBroadcaster;
  /** ID generator function. Defaults to timestamp-based generator. */
  generateId?: (prefix: string) => string;
}

let idCounter = 0;

function defaultGenerateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

export class DelegationEngine {
  private readonly bus: A2AMessageBus;
  private readonly tracker: CorrelationTracker;
  private readonly broadcaster?: StatusBroadcaster;
  private readonly generateId: (prefix: string) => string;

  constructor(opts: DelegationEngineOptions) {
    this.bus = opts.messageBus;
    this.tracker = opts.correlationTracker;
    this.broadcaster = opts.broadcaster;
    this.generateId = opts.generateId ?? defaultGenerateId;
  }

  // ── Single Delegation ────────────────────────────────────────

  /**
   * Delegate a single sub-task to another agent.
   * Returns the sent request message and its correlation ID.
   */
  async delegate(request: DelegationRequest): Promise<DelegationResult> {
    const messageId = this.generateId('a2a-del');
    const correlationId = this.generateId('corr');
    const now = new Date().toISOString();
    const ttlMs = (request.retryPolicy ?? A2A_DEFAULT_RETRY_POLICY).ttlMs;

    const payload: A2ADelegationRequestPayload = {
      taskId: request.taskId,
      summary: request.summary,
      instructions: request.instructions,
      requiredCapabilities: request.requiredCapabilities,
      constraints: request.constraints,
      deadline: request.deadline,
      context: request.context ?? {},
      allowSubDelegation: request.allowSubDelegation ?? false,
    };

    const message: A2ADelegationRequest = {
      id: messageId,
      correlationId,
      type: 'delegation_request',
      sender: request.fromAgentId,
      recipient: request.routing.target,
      routing: request.routing,
      priority: request.priority ?? 'normal',
      status: 'sent',
      payload,
      retryPolicy: request.retryPolicy ?? A2A_DEFAULT_RETRY_POLICY,
      attemptCount: 1,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      protocolVersion: A2A_PROTOCOL_VERSION,
    };

    // Register in correlation tracker
    this.tracker.registerCorrelation(correlationId, messageId);
    this.tracker.addSubTask(correlationId, {
      messageId,
      assigneeId: request.routing.target,
      taskId: request.taskId,
      status: 'queued',
      progressPercent: 0,
      artifacts: [],
      updatedAt: now,
    });

    // Send through the bus
    await this.bus.send(message);

    this.broadcaster?.emit({
      type: 'delegation:requested',
      message,
      timestamp: now,
    });

    return { requestMessage: message, correlationId };
  }

  // ── Work Splitting ───────────────────────────────────────────

  /**
   * Split a task into multiple sub-tasks and delegate each one.
   * All sub-tasks share a single correlationId so results can be merged.
   */
  async splitWork(plan: SplitWorkPlan): Promise<SplitWorkResult> {
    const correlationId = this.generateId('corr');
    const originMessageId = this.generateId('a2a-split');
    const now = new Date().toISOString();

    // Register the correlation group
    this.tracker.registerCorrelation(correlationId, originMessageId);

    const delegations: DelegationResult[] = [];

    for (const subTask of plan.subTasks) {
      const messageId = this.generateId('a2a-del');
      const ttlMs = (subTask.retryPolicy ?? A2A_DEFAULT_RETRY_POLICY).ttlMs;

      const payload: A2ADelegationRequestPayload = {
        taskId: subTask.taskId,
        summary: subTask.summary,
        instructions: subTask.instructions,
        requiredCapabilities: subTask.requiredCapabilities,
        constraints: subTask.constraints,
        deadline: subTask.deadline,
        context: {
          ...(subTask.context ?? {}),
          parentTaskId: plan.parentTaskId,
          correlationId,
        },
        allowSubDelegation: subTask.allowSubDelegation ?? false,
      };

      const message: A2ADelegationRequest = {
        id: messageId,
        correlationId,
        type: 'delegation_request',
        sender: plan.coordinatorAgentId,
        recipient: subTask.routing.target,
        routing: subTask.routing,
        priority: subTask.priority ?? plan.priority ?? 'normal',
        status: 'sent',
        payload,
        retryPolicy: subTask.retryPolicy ?? A2A_DEFAULT_RETRY_POLICY,
        attemptCount: 1,
        createdAt: now,
        updatedAt: now,
        expiresAt: new Date(Date.now() + ttlMs).toISOString(),
        protocolVersion: A2A_PROTOCOL_VERSION,
      };

      // Track sub-task
      this.tracker.addSubTask(correlationId, {
        messageId,
        assigneeId: subTask.routing.target,
        taskId: subTask.taskId,
        status: 'queued',
        progressPercent: 0,
        artifacts: [],
        updatedAt: now,
      });

      await this.bus.send(message);
      delegations.push({ requestMessage: message, correlationId });
    }

    return { correlationId, delegations };
  }

  // ── Responding to Delegation ─────────────────────────────────

  /**
   * Create and send a delegation response (accept, reject, or counter-propose).
   */
  async respond(
    originalRequest: A2ADelegationRequest,
    respondingAgentId: string,
    outcome: A2ADelegationOutcome,
    options?: {
      reason?: string;
      counterProposal?: A2ADelegationResponsePayload['counterProposal'];
      estimatedCompletionTime?: string;
    },
  ): Promise<A2ADelegationResponse> {
    const messageId = this.generateId('a2a-resp');
    const now = new Date().toISOString();
    const ttlMs = A2A_DEFAULT_RETRY_POLICY.ttlMs;

    const payload: A2ADelegationResponsePayload = {
      outcome,
      reason: options?.reason,
      counterProposal: options?.counterProposal,
      estimatedCompletionTime: options?.estimatedCompletionTime,
    };

    const response: A2ADelegationResponse = {
      id: messageId,
      correlationId: originalRequest.correlationId,
      inReplyTo: originalRequest.id,
      type: 'delegation_response',
      sender: respondingAgentId,
      recipient: originalRequest.sender,
      routing: {
        strategy: 'direct',
        target: originalRequest.sender,
      },
      priority: originalRequest.priority,
      status: 'sent',
      payload,
      retryPolicy: A2A_DEFAULT_RETRY_POLICY,
      attemptCount: 1,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      protocolVersion: A2A_PROTOCOL_VERSION,
    };

    await this.bus.send(response);

    // Update sub-task status based on outcome
    if (outcome === 'accepted') {
      this.tracker.updateSubTask(originalRequest.correlationId, originalRequest.id, {
        status: 'in_progress',
      });
    } else if (outcome === 'rejected') {
      this.tracker.updateSubTask(originalRequest.correlationId, originalRequest.id, {
        status: 'failed',
      });
    }

    this.broadcaster?.emit({
      type: 'delegation:responded',
      message: response,
      data: { outcome },
      timestamp: now,
    });

    return response;
  }

  // ── Status Reporting ─────────────────────────────────────────

  /**
   * Send a status update for a delegated task.
   * Automatically updates the correlation tracker.
   */
  async reportStatus(
    correlationId: string,
    reportingAgentId: string,
    originalRequestId: string,
    update: {
      taskId: string;
      status: A2AStatusUpdatePayload['status'];
      description: string;
      progressPercent?: number;
      artifacts?: A2AArtifact[];
      blockedReason?: string;
      inputRequest?: string;
    },
    /** Recipient of the status update (usually the delegating agent). */
    recipientId: string,
  ): Promise<A2AStatusUpdate> {
    const messageId = this.generateId('a2a-status');
    const now = new Date().toISOString();
    const ttlMs = A2A_DEFAULT_RETRY_POLICY.ttlMs;

    const payload: A2AStatusUpdatePayload = {
      taskId: update.taskId,
      status: update.status,
      description: update.description,
      progressPercent: update.progressPercent,
      artifacts: update.artifacts,
      blockedReason: update.blockedReason,
      inputRequest: update.inputRequest,
    };

    const message: A2AStatusUpdate = {
      id: messageId,
      correlationId,
      inReplyTo: originalRequestId,
      type: 'status_update',
      sender: reportingAgentId,
      recipient: recipientId,
      routing: {
        strategy: 'direct',
        target: recipientId,
      },
      priority: 'normal',
      status: 'sent',
      payload,
      retryPolicy: A2A_DEFAULT_RETRY_POLICY,
      attemptCount: 1,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      protocolVersion: A2A_PROTOCOL_VERSION,
    };

    // Update correlation tracker
    this.tracker.updateSubTask(correlationId, originalRequestId, {
      status: update.status,
      progressPercent: update.progressPercent,
      artifacts: update.artifacts,
    });

    await this.bus.send(message);

    this.broadcaster?.emitStatusUpdate(message);

    // Check if the whole correlation group is now complete
    if (this.tracker.isComplete(correlationId)) {
      this.broadcaster?.emit({
        type: 'correlation:completed',
        message,
        data: {
          correlationId,
          artifacts: this.tracker.collectArtifacts(correlationId),
        },
        timestamp: now,
      });
    }

    return message;
  }

  // ── Queries ──────────────────────────────────────────────────

  /** Get the aggregated status of a delegation correlation group. */
  getCorrelationStatus(correlationId: string): CorrelationStatus | null {
    return this.tracker.getStatus(correlationId);
  }

  /** Check if all sub-tasks in a delegation are complete. */
  isDelegationComplete(correlationId: string): boolean {
    return this.tracker.isComplete(correlationId);
  }

  /** Collect all artifacts from completed sub-tasks. */
  collectResults(correlationId: string): A2AArtifact[] {
    return this.tracker.collectArtifacts(correlationId);
  }
}
