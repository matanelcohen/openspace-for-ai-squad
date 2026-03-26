/**
 * HITL Interrupt Model — Types for the interrupt point abstraction.
 *
 * Inspired by LangGraph's interrupt model: any node handler can signal
 * uncertainty by throwing an InterruptError, which pauses the workflow,
 * serializes partial state, and yields control to a human reviewer.
 *
 * This module defines the data model for:
 * - Interrupt requests (what the node is asking)
 * - Interrupt policies (declarative rules on when to interrupt)
 * - Interrupt state (serialized partial execution for resume)
 * - Interrupt resolutions (human decisions)
 */

import type { EscalationPriority, EscalationReason } from './escalation.js';

// ── Interrupt Reason ────────────────────────────────────────────

/**
 * Why an interrupt was triggered. Extends EscalationReason with
 * additional interrupt-specific reasons.
 */
export type InterruptReason =
  | EscalationReason
  | 'confidence_below_threshold'
  | 'destructive_action'
  | 'ambiguous_input'
  | 'cost_limit_exceeded'
  | 'safety_check';

// ── Interrupt Request ───────────────────────────────────────────

/**
 * The payload a node handler provides when requesting an interrupt.
 * This is what gets serialized and shown to the human reviewer.
 */
export interface InterruptRequest {
  /** Why the interrupt was triggered. */
  reason: InterruptReason;

  /** Human-readable message explaining what needs review. */
  message: string;

  /**
   * Agent's confidence score at the time of interrupt (0–1).
   * Lower scores indicate higher uncertainty.
   */
  confidenceScore: number;

  /**
   * The proposed action or output the agent wants to take.
   * Shown to the reviewer for approve/reject/modify.
   */
  proposedAction: unknown;

  /**
   * Supporting evidence or reasoning from the agent.
   * Helps the reviewer make an informed decision.
   */
  reasoning?: string;

  /**
   * Options presented to the human reviewer.
   * If provided, the reviewer picks one instead of free-form input.
   */
  choices?: InterruptChoice[];

  /**
   * Partial state from the node's execution up to the interrupt point.
   * Used to resume execution without re-running completed work.
   */
  partialState?: Record<string, unknown>;

  /**
   * Arbitrary metadata for domain-specific context.
   * Rendered in the review UI alongside the message.
   */
  metadata?: Record<string, unknown>;
}

/** A discrete choice offered to the human reviewer. */
export interface InterruptChoice {
  /** Unique identifier for this choice. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** Optional description with more detail. */
  description?: string;
  /** The value returned to the node if this choice is selected. */
  value: unknown;
}

// ── Interrupt Policy ────────────────────────────────────────────

/**
 * Declarative policy that can be attached to any StepNode to
 * automatically trigger interrupts based on runtime conditions.
 * Evaluated by the engine after node execution but before committing output.
 */
export interface InterruptPolicy {
  /**
   * If the node's output includes a `confidenceScore` field and it falls
   * below this threshold, trigger an interrupt automatically.
   * Range: 0–1. Omit to disable confidence-based interrupts.
   */
  confidenceThreshold?: number;

  /**
   * JSONPath-like expressions evaluated against the node's output.
   * If any expression returns true, the interrupt triggers.
   * Example: "output.risk === 'high'" or "output.cost > 1000"
   */
  interruptWhen?: string[];

  /**
   * Escalation chain to use when this policy triggers.
   * Falls back to the workflow-level default chain if not set.
   */
  escalationChainId?: string;

  /**
   * Priority assigned to interrupts triggered by this policy.
   * Defaults to 'medium'.
   */
  priority?: EscalationPriority;

  /**
   * The prompt shown to the human reviewer when this policy triggers.
   * Supports template variables: {{nodeId}}, {{confidence}}, {{output}}.
   */
  reviewPrompt?: string;

  /** Timeout policy for the interrupt. */
  timeout?: InterruptTimeoutPolicy;
}

// ── Interrupt Timeout Policy ────────────────────────────────────

/**
 * Defines what happens when an interrupt is not resolved within the
 * allotted time. Prevents workflows from being stuck indefinitely.
 */
export interface InterruptTimeoutPolicy {
  /**
   * Maximum time (ms) to wait for human resolution.
   * After this duration, the `defaultAction` is taken automatically.
   */
  timeoutMs: number;

  /**
   * Action taken when the timeout expires.
   * - 'approve': Auto-approve with the proposed action.
   * - 'reject': Auto-reject and fail the node.
   * - 'escalate': Escalate to the next level in the chain.
   * - 'skip': Skip the node (mark as skipped, continue workflow).
   * - 'use_default': Use the `defaultValue` as the node output.
   */
  defaultAction: 'approve' | 'reject' | 'escalate' | 'skip' | 'use_default';

  /**
   * Default output value used when `defaultAction` is 'use_default'.
   * Must be JSON-serializable.
   */
  defaultValue?: unknown;
}

// ── Enhanced HITL Gate Config ───────────────────────────────────

/**
 * Extended configuration for `hitl_gate` nodes.
 * Backward-compatible with the existing HITLGateNodeConfig
 * (escalationChainId + prompt remain optional).
 */
export interface EnhancedHITLGateConfig {
  /** Escalation chain to follow. */
  escalationChainId?: string;

  /** Message shown to the reviewer. */
  prompt?: string;

  /** Priority for this gate's escalation items. Defaults to 'medium'. */
  priority?: EscalationPriority;

  /** The reason category for escalations from this gate. */
  reason?: EscalationReason;

  /**
   * Timeout policy. If not set, the gate waits indefinitely
   * (existing behavior preserved).
   */
  timeout?: InterruptTimeoutPolicy;

  /**
   * If true, require the reviewer to provide structured output
   * (not just approve/reject). The `choices` field defines options.
   */
  requireOutput?: boolean;

  /** Predefined choices for the reviewer. */
  choices?: InterruptChoice[];

  /**
   * Context snapshot configuration — controls what data from the
   * ExecutionContext is included in the escalation item for reviewer
   * inspection.
   */
  contextSnapshot?: ContextSnapshotConfig;
}

/** Controls what ExecutionContext data is captured for reviewer inspection. */
export interface ContextSnapshotConfig {
  /** Include workflow variables. Default: true. */
  includeVars?: boolean;

  /** Include outputs from specific predecessor nodes. Default: all. */
  includeNodeOutputs?: string[] | 'all' | 'none';

  /** Additional fields to extract via JSONPath expressions. */
  extraFields?: Array<{
    /** Display label. */
    label: string;
    /** JSONPath expression resolved against ExecutionContext. */
    path: string;
  }>;

  /**
   * Maximum size (bytes) for the serialized snapshot.
   * Truncates large outputs to prevent bloated escalation items.
   */
  maxSizeBytes?: number;
}

// ── Interrupt Resolution ────────────────────────────────────────

/** The outcome of a human reviewing an interrupt. */
export type InterruptResolutionAction =
  | 'approve'
  | 'reject'
  | 'modify'
  | 'delegate'
  | 'retry';

/**
 * The human's decision after reviewing an interrupt.
 * Returned to the engine to resume execution.
 */
export interface InterruptResolution {
  /** What the reviewer decided. */
  action: InterruptResolutionAction;

  /**
   * Output provided by the reviewer. Semantics depend on action:
   * - 'approve': Optional override for the proposed output.
   * - 'reject': Optional rejection reason (string).
   * - 'modify': The modified output (required).
   * - 'delegate': Target agent/reviewer ID (string).
   * - 'retry': Optional modified input for retry.
   */
  output?: unknown;

  /** Reviewer's comment explaining their decision. */
  comment?: string;

  /** ID of the reviewer who resolved this. */
  reviewerId: string;

  /** ISO-8601 timestamp of resolution. */
  resolvedAt: string;

  /** If action is 'delegate', the target for delegation. */
  delegateTo?: string;
}

// ── Interrupt State (serialized) ────────────────────────────────

/**
 * Serialized snapshot of an interrupt, stored in the checkpoint.
 * Contains everything needed to present the interrupt to a reviewer
 * and resume execution after resolution.
 */
export interface InterruptState {
  /** Unique ID for this interrupt instance. */
  id: string;

  /** The node that triggered the interrupt. */
  nodeId: string;

  /** The workflow execution ID. */
  executionId: string;

  /** The interrupt request from the node handler. */
  request: InterruptRequest;

  /** The escalation item ID (if one was created). */
  escalationId: string | null;

  /** Current status of the interrupt. */
  status: 'pending' | 'claimed' | 'resolved' | 'timed_out' | 'auto_resolved';

  /** The resolution, once provided. */
  resolution: InterruptResolution | null;

  /** ISO-8601 timestamp when the interrupt was created. */
  createdAt: string;

  /** ISO-8601 timestamp when the interrupt times out. */
  timeoutAt: string | null;

  /**
   * Timeout policy in effect for this interrupt.
   * Copied from the node's InterruptPolicy or HITLGateConfig at creation time.
   */
  timeoutPolicy: InterruptTimeoutPolicy | null;
}

// ── Interruptable Node Config ───────────────────────────────────

/**
 * Mixin interface that can be added to any StepNode to make it
 * interruptable. Task nodes, condition nodes, and sub-workflow nodes
 * can all declare interrupt policies.
 *
 * This is what gets added to the StepNode interface.
 */
export interface InterruptableNodeConfig {
  /**
   * Declarative interrupt policy. If set, the engine evaluates this
   * policy after node execution and before committing the output.
   */
  interruptPolicy?: InterruptPolicy;
}

// ── Engine Integration Types ────────────────────────────────────

/**
 * Handler called by the engine when an interrupt is triggered.
 * Responsible for creating the escalation item and returning its ID.
 *
 * This extends the existing `onHITLGate` handler with richer context.
 */
export type InterruptHandler = (
  interrupt: InterruptState,
) => Promise<string>; // Returns escalation ID

/**
 * Provider that resolves an interrupt by returning the human's decision.
 * Called by the engine when resuming a paused workflow.
 */
export type InterruptResolver = (
  interruptId: string,
) => Promise<InterruptResolution>;

/**
 * Events specific to the interrupt lifecycle.
 * Extend the existing WorkflowEvent union.
 */
export type InterruptEvent =
  | 'interrupt:created'
  | 'interrupt:claimed'
  | 'interrupt:resolved'
  | 'interrupt:timed_out'
  | 'interrupt:auto_resolved';

/** Payload for interrupt-specific events. */
export interface InterruptEventPayload {
  executionId: string;
  workflowId: string;
  event: InterruptEvent;
  nodeId: string;
  interruptId: string;
  timestamp: string;
  data?: {
    request?: InterruptRequest;
    resolution?: InterruptResolution;
    timeoutPolicy?: InterruptTimeoutPolicy;
  };
}

// ── Interrupt Store ─────────────────────────────────────────────

/**
 * Persistence interface for managing interrupt lifecycle.
 * Provides query-optimized access to interrupt states as a secondary
 * index alongside the checkpoint store.
 */
export interface InterruptStore {
  /** Save or update an interrupt state. */
  save(state: InterruptState): Promise<void>;

  /** Load an interrupt by ID. */
  load(interruptId: string): Promise<InterruptState | null>;

  /** Load all active (unresolved) interrupts for an execution. */
  loadByExecution(executionId: string): Promise<InterruptState[]>;

  /** Load the interrupt for a specific paused node. */
  loadByNode(executionId: string, nodeId: string): Promise<InterruptState | null>;

  /** Resolve an interrupt — sets status to 'resolved' and stores the resolution. */
  resolve(interruptId: string, resolution: InterruptResolution): Promise<InterruptState>;

  /** Find all interrupts that have timed out (timeoutAt < now and still pending/claimed). */
  findTimedOut(now?: string): Promise<InterruptState[]>;

  /** Delete all interrupts for an execution (cleanup after completion). */
  deleteByExecution(executionId: string): Promise<void>;
}
