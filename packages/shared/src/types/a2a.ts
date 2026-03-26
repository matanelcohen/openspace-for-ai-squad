/**
 * A2A (Agent-to-Agent) message protocol types.
 *
 * Defines the formal schema for agent-to-agent communication: typed message
 * envelopes, delegation/handoff/negotiation payloads, lifecycle states,
 * routing rules, retry semantics, and conflict resolution.
 *
 * Design references:
 * - Google A2A protocol (agent-to-agent task delegation via JSON-RPC envelopes)
 * - CrewAI delegation patterns (role-based task delegation with context passing)
 *
 * @see docs/a2a-protocol.md for the full protocol specification.
 */

// ── Message Types ────────────────────────────────────────────────

/** Discriminator for A2A message payloads. */
export type A2AMessageType =
  | 'delegation_request'
  | 'delegation_response'
  | 'status_update'
  | 'handoff'
  | 'negotiation';

// ── Message Priority ─────────────────────────────────────────────

/** Priority level for A2A messages (aligns with TaskPriority). */
export type A2AMessagePriority = 'critical' | 'high' | 'normal' | 'low';

// ── Message Lifecycle ────────────────────────────────────────────

/** Lifecycle status of an A2A message. */
export type A2AMessageStatus =
  | 'sent'
  | 'received'
  | 'acknowledged'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired'
  | 'cancelled';

// ── Routing ──────────────────────────────────────────────────────

/** How a message should be routed to its recipient(s). */
export type A2ARoutingStrategy =
  | 'direct'       // Specific agent by ID
  | 'role_based'   // Any agent matching a role (e.g., "Backend")
  | 'broadcast'    // All agents in the squad
  | 'capability';  // Any agent with matching capability tags

/** Routing metadata attached to every A2A envelope. */
export interface A2ARoutingInfo {
  /** Routing strategy for this message. */
  strategy: A2ARoutingStrategy;
  /**
   * For 'direct': target agent ID.
   * For 'role_based': target role string.
   * For 'capability': comma-separated capability tags.
   * For 'broadcast': ignored (empty string).
   */
  target: string;
  /** Agent IDs to exclude from routing (e.g., the sender). */
  excludeAgentIds?: string[];
  /**
   * For 'role_based' and 'capability' strategies: how to pick when
   * multiple agents match.
   */
  selectionStrategy?: 'first_available' | 'least_loaded' | 'round_robin';
}

// ── Retry Configuration ──────────────────────────────────────────

/** Retry semantics for failed or unacknowledged messages. */
export interface A2ARetryPolicy {
  /** Maximum number of delivery attempts (1 = no retries). */
  maxAttempts: number;
  /** Initial backoff delay in milliseconds. */
  initialDelayMs: number;
  /** Backoff multiplier applied after each failed attempt. */
  backoffMultiplier: number;
  /** Maximum backoff delay cap in milliseconds. */
  maxDelayMs: number;
  /** TTL in milliseconds — message expires if unacknowledged after this. */
  ttlMs: number;
}

// ── Delegation Request Payload ───────────────────────────────────

/** Payload for a delegation_request message. */
export interface A2ADelegationRequestPayload {
  /** ID of the task being delegated. */
  taskId: string;
  /** Short description of the delegated work. */
  summary: string;
  /** Detailed instructions or context for the delegate. */
  instructions: string;
  /** Required capabilities or expertise for the delegate. */
  requiredCapabilities?: string[];
  /** Constraints or boundaries for the delegated work. */
  constraints?: string[];
  /** ISO-8601 deadline for completion (optional). */
  deadline?: string;
  /**
   * Context passed from the delegating agent.
   * Maps to CrewAI's context-passing pattern and Google A2A's artifact model.
   */
  context: Record<string, unknown>;
  /** If true, the delegate may further sub-delegate. */
  allowSubDelegation: boolean;
}

// ── Delegation Response Payload ──────────────────────────────────

/** Outcome of a delegation request. */
export type A2ADelegationOutcome =
  | 'accepted'
  | 'rejected'
  | 'counter_proposed';

/** Payload for a delegation_response message. */
export interface A2ADelegationResponsePayload {
  /** Outcome of the delegation request. */
  outcome: A2ADelegationOutcome;
  /** Reason for rejection or counter-proposal (required if not accepted). */
  reason?: string;
  /**
   * Counter-proposal: modified instructions or scope if outcome is
   * 'counter_proposed'.
   */
  counterProposal?: {
    summary: string;
    instructions: string;
    estimatedEffort?: string;
  };
  /** Estimated completion time as ISO-8601 duration (e.g., "PT2H"). */
  estimatedCompletionTime?: string;
}

// ── Status Update Payload ────────────────────────────────────────

/** Granular progress status for delegated work. */
export type A2AProgressStatus =
  | 'queued'
  | 'in_progress'
  | 'blocked'
  | 'needs_input'
  | 'completed'
  | 'failed';

/** Payload for a status_update message. */
export interface A2AStatusUpdatePayload {
  /** ID of the task being reported on. */
  taskId: string;
  /** Current progress status. */
  status: A2AProgressStatus;
  /** Human-readable progress description. */
  description: string;
  /** Numeric progress percentage (0–100), if measurable. */
  progressPercent?: number;
  /** Artifacts or outputs produced so far. */
  artifacts?: A2AArtifact[];
  /** If blocked, what is needed to unblock. */
  blockedReason?: string;
  /** If needs_input, the question or request for the delegator. */
  inputRequest?: string;
}

/** An artifact (output/deliverable) produced by an agent. */
export interface A2AArtifact {
  /** Unique artifact ID. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** MIME type of the artifact content. */
  mimeType: string;
  /** URI or file path to the artifact. */
  uri: string;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
}

// ── Handoff Payload ──────────────────────────────────────────────

/** Reason for handing off work to another agent. */
export type A2AHandoffReason =
  | 'out_of_scope'
  | 'capability_mismatch'
  | 'overloaded'
  | 'escalation'
  | 'collaboration_needed'
  | 'completion';

/** Payload for a handoff message. */
export interface A2AHandoffPayload {
  /** ID of the task being handed off. */
  taskId: string;
  /** Why the handoff is happening. */
  reason: A2AHandoffReason;
  /** Detailed explanation of the handoff. */
  description: string;
  /** Current state of the work being handed off. */
  workState: Record<string, unknown>;
  /** Artifacts produced before the handoff. */
  artifacts?: A2AArtifact[];
  /** Suggested next steps for the receiving agent. */
  suggestedNextSteps?: string[];
  /**
   * Suggested target agent ID or role. The router uses this as a hint
   * but may override based on availability.
   */
  suggestedTarget?: string;
}

// ── Negotiation Payload ──────────────────────────────────────────

/** Phase of an agent-to-agent negotiation. */
export type A2ANegotiationPhase =
  | 'propose'
  | 'counter'
  | 'accept'
  | 'reject'
  | 'withdraw';

/** Payload for a negotiation message (e.g., resolving task ownership). */
export interface A2ANegotiationPayload {
  /** ID of the negotiation thread (groups related proposals). */
  negotiationId: string;
  /** Current phase of the negotiation. */
  phase: A2ANegotiationPhase;
  /** What is being negotiated (task assignment, resource sharing, etc.). */
  subject: string;
  /** The proposal or counter-proposal details. */
  proposal: Record<string, unknown>;
  /** Reasoning or justification for the proposal. */
  reasoning: string;
  /**
   * Priority claim score (0–1). Used for conflict resolution when
   * multiple agents compete for the same task. Higher = stronger claim.
   * Factors: expertise match, current load, past performance.
   */
  claimScore?: number;
}

// ── Conflict Resolution ──────────────────────────────────────────

/** Strategy for resolving concurrent delegation conflicts. */
export type A2AConflictResolutionStrategy =
  | 'first_writer_wins'
  | 'priority_based'
  | 'claim_score'
  | 'lead_decides'
  | 'merge';

/** Result of a conflict resolution attempt. */
export interface A2AConflictResolution {
  /** The resolution strategy that was applied. */
  strategy: A2AConflictResolutionStrategy;
  /** ID of the winning message (if applicable). */
  winningMessageId: string;
  /** IDs of messages that lost / were superseded. */
  supersededMessageIds: string[];
  /** Human-readable explanation of the resolution. */
  explanation: string;
  /** ISO-8601 timestamp of resolution. */
  resolvedAt: string;
  /** The agent or system that performed the resolution. */
  resolvedBy: string;
}

// ── Message Envelope ─────────────────────────────────────────────

/**
 * The A2A message envelope — the top-level container for all
 * agent-to-agent communication.
 *
 * Design aligns with:
 * - Google A2A: JSON-RPC-style envelope with task/artifact model
 * - CrewAI: role-based delegation with context passing
 *
 * Every message has a unique ID, correlation ID for request/response
 * pairing, typed payload via discriminated union on `type`.
 */
export interface A2AMessageEnvelope<T extends A2AMessageType = A2AMessageType> {
  /** Unique message ID (UUIDv4). */
  id: string;

  /**
   * Correlation ID linking related messages in a conversation.
   * A delegation_response shares the correlation_id of its request.
   * Maps to Google A2A's task ID concept.
   */
  correlationId: string;

  /**
   * Optional: ID of the message this is replying to.
   * Enables threaded conversations within a correlation group.
   */
  inReplyTo?: string;

  /** Message type discriminator. */
  type: T;

  /** Sender agent ID. */
  sender: string;

  /** Recipient agent ID, role, or 'team' for broadcast. */
  recipient: string;

  /** Routing metadata. */
  routing: A2ARoutingInfo;

  /** Message priority. */
  priority: A2AMessagePriority;

  /** Current lifecycle status of this message. */
  status: A2AMessageStatus;

  /** Typed payload — shape determined by `type` field. */
  payload: A2APayloadMap[T];

  /** Retry policy for this message. */
  retryPolicy: A2ARetryPolicy;

  /** Number of delivery attempts so far. */
  attemptCount: number;

  /** ISO-8601 timestamp when the message was created. */
  createdAt: string;

  /** ISO-8601 timestamp of the last status change. */
  updatedAt: string;

  /** ISO-8601 expiration timestamp (derived from retryPolicy.ttlMs). */
  expiresAt: string;

  /**
   * Protocol version. Enables forward-compatible schema evolution.
   * Current version: 1.
   */
  protocolVersion: number;

  /** Optional metadata for extensibility. */
  metadata?: Record<string, unknown>;
}

// ── Payload Type Map ─────────────────────────────────────────────

/** Maps message types to their corresponding payload shapes. */
export interface A2APayloadMap {
  delegation_request: A2ADelegationRequestPayload;
  delegation_response: A2ADelegationResponsePayload;
  status_update: A2AStatusUpdatePayload;
  handoff: A2AHandoffPayload;
  negotiation: A2ANegotiationPayload;
}

// ── Concrete Message Types (convenience aliases) ─────────────────

export type A2ADelegationRequest = A2AMessageEnvelope<'delegation_request'>;
export type A2ADelegationResponse = A2AMessageEnvelope<'delegation_response'>;
export type A2AStatusUpdate = A2AMessageEnvelope<'status_update'>;
export type A2AHandoff = A2AMessageEnvelope<'handoff'>;
export type A2ANegotiation = A2AMessageEnvelope<'negotiation'>;

/** Union of all concrete A2A message types. */
export type A2AMessage =
  | A2ADelegationRequest
  | A2ADelegationResponse
  | A2AStatusUpdate
  | A2AHandoff
  | A2ANegotiation;

// ── Message Lifecycle Event ──────────────────────────────────────

/** Recorded when a message transitions between lifecycle states. */
export interface A2ALifecycleEvent {
  /** ID of the message this event pertains to. */
  messageId: string;
  /** Previous status (null for initial 'sent' event). */
  previousStatus: A2AMessageStatus | null;
  /** New status. */
  newStatus: A2AMessageStatus;
  /** ISO-8601 timestamp of the transition. */
  timestamp: string;
  /** Agent or system that triggered the transition. */
  actor: string;
  /** Optional details or reason for the transition. */
  details?: string;
}

// ── Router Interface ─────────────────────────────────────────────

/**
 * Interface for the A2A message router.
 *
 * The router is responsible for:
 * 1. Resolving the routing strategy to concrete agent IDs
 * 2. Delivering messages to target agents
 * 3. Managing message lifecycle transitions
 * 4. Handling retries for unacknowledged messages
 * 5. Detecting and resolving conflicts
 */
export interface A2ARouter {
  /** Send a message through the routing layer. */
  send(message: A2AMessage): Promise<A2ALifecycleEvent>;

  /** Acknowledge receipt of a message. */
  acknowledge(messageId: string, agentId: string): Promise<A2ALifecycleEvent>;

  /** Resolve routing to concrete agent IDs based on strategy. */
  resolveRecipients(routing: A2ARoutingInfo): Promise<string[]>;

  /** Check for and resolve conflicts on a correlation group. */
  resolveConflicts(correlationId: string): Promise<A2AConflictResolution | null>;

  /** Get all messages in a correlation group. */
  getConversation(correlationId: string): Promise<A2AMessage[]>;

  /** Get the lifecycle history of a message. */
  getLifecycle(messageId: string): Promise<A2ALifecycleEvent[]>;
}

// ── Default Retry Policy ─────────────────────────────────────────

/** Default retry policy values (used when no custom policy is specified). */
export const A2A_DEFAULT_RETRY_POLICY: Readonly<A2ARetryPolicy> = {
  maxAttempts: 3,
  initialDelayMs: 1_000,
  backoffMultiplier: 2,
  maxDelayMs: 30_000,
  ttlMs: 300_000, // 5 minutes
};

/** Protocol version for the current schema. */
export const A2A_PROTOCOL_VERSION = 1;
