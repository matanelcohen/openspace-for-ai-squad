/**
 * Escalation types — HITL (Human-in-the-Loop) escalation framework.
 *
 * Defines the data structures for escalation items, confidence thresholds,
 * escalation chains, audit trails, and review queue management.
 */

// ── Escalation Status ────────────────────────────────────────────

/** Lifecycle status of an escalation item. */
export type EscalationStatus =
  | 'pending'
  | 'claimed'
  | 'approved'
  | 'rejected'
  | 'timed_out'
  | 'auto_escalated';

/** Priority level for escalation items. */
export type EscalationPriority = 'critical' | 'high' | 'medium' | 'low';

/** The reason an escalation was triggered. */
export type EscalationReason =
  | 'low_confidence'
  | 'explicit_request'
  | 'policy_violation'
  | 'timeout'
  | 'chain_escalation';

// ── Confidence Threshold ─────────────────────────────────────────

/** Configuration for confidence-based escalation triggers. */
export interface ConfidenceThreshold {
  /** Minimum confidence score (0–1) below which escalation triggers. */
  threshold: number;
  /** The escalation chain level to start at when triggered. */
  escalationLevel: number;
  /** Optional: only apply to specific agent roles. */
  agentRoles?: string[];
}

// ── Escalation Chain ─────────────────────────────────────────────

/** A single level in an escalation chain. */
export interface EscalationChainLevel {
  /** Level number (1 = first responder, 2 = senior, 3 = admin, etc.). */
  level: number;
  /** Display name for this level (e.g., "L1 Reviewer"). */
  name: string;
  /** Reviewer IDs eligible to claim items at this level. */
  reviewerIds: string[];
  /** Timeout in milliseconds before auto-escalating to the next level. */
  timeoutMs: number;
}

/** An escalation chain defining the path from initial review to final authority. */
export interface EscalationChain {
  /** Unique identifier for this chain. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Ordered levels (must have at least one). */
  levels: EscalationChainLevel[];
}

// ── Context Snapshot ─────────────────────────────────────────────

/** Serialized context attached to an escalation item for reviewer inspection. */
export interface EscalationContext {
  /** The agent that triggered the escalation. */
  agentId: string;
  /** Agent's confidence score at the time of escalation (0–1). */
  confidenceScore: number;
  /** ID of the task/workflow node that triggered escalation. */
  sourceNodeId: string;
  /** ID of the workflow this escalation belongs to. */
  workflowId: string;
  /** The agent's proposed action or output. */
  proposedAction: string;
  /** Supporting evidence or reasoning from the agent. */
  reasoning: string;
  /** Arbitrary metadata for domain-specific context. */
  metadata: Record<string, unknown>;
}

// ── Audit Trail ──────────────────────────────────────────────────

/** An entry in the escalation audit trail. */
export interface AuditEntry {
  /** Unique ID for this audit entry. */
  id: string;
  /** ID of the escalation item this entry belongs to. */
  escalationId: string;
  /** The action that was performed. */
  action: EscalationStatus | 'created' | 'context_updated' | 'level_changed';
  /** Who performed the action (reviewer ID, 'system', or agent ID). */
  actor: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Optional details about the action. */
  details?: string;
  /** Previous status before this action. */
  previousStatus?: EscalationStatus;
  /** New status after this action. */
  newStatus?: EscalationStatus;
}

// ── Escalation Item ──────────────────────────────────────────────

/** A single escalation item in the review queue. */
export interface EscalationItem {
  /** Unique identifier. */
  id: string;
  /** Current lifecycle status. */
  status: EscalationStatus;
  /** Why this was escalated. */
  reason: EscalationReason;
  /** Priority level. */
  priority: EscalationPriority;
  /** The escalation chain being followed. */
  chainId: string;
  /** Current level in the chain. */
  currentLevel: number;
  /** Serialized context for reviewer inspection. */
  context: EscalationContext;
  /** ID of the reviewer who claimed this item (null if unclaimed). */
  claimedBy: string | null;
  /** ISO-8601 timestamp when claimed (null if unclaimed). */
  claimedAt: string | null;
  /** ISO-8601 timestamp when this item was created. */
  createdAt: string;
  /** ISO-8601 timestamp when this item was last updated. */
  updatedAt: string;
  /** ISO-8601 timestamp when the current level times out. */
  timeoutAt: string;
  /** Reviewer's comment when approving/rejecting. */
  reviewComment: string | null;
  /** Complete audit trail for this item. */
  auditTrail: AuditEntry[];
}

// ── Serialized State ─────────────────────────────────────────────

/** Serializable snapshot of the entire escalation queue state. */
export interface EscalationQueueState {
  /** All escalation items. */
  items: EscalationItem[];
  /** All configured escalation chains. */
  chains: EscalationChain[];
  /** All configured confidence thresholds. */
  thresholds: ConfidenceThreshold[];
  /** ISO-8601 timestamp of serialization. */
  serializedAt: string;
  /** Schema version for forward-compatibility. */
  version: number;
}
