/**
 * DAG Workflow Engine — Enhanced types for the directed acyclic graph
 * workflow engine with conditional predicates, execution context,
 * checkpoint storage, and Tool Registry integration.
 *
 * These types extend the foundation in `./workflow.ts` and are the
 * target data model for the next-generation engine (`dag-engine.ts`).
 */

import type { InterruptPolicy, InterruptResolution, InterruptState } from './interrupt.js';
import type { Tracer } from '@matanelcohen/openspace-tracing';

// ── Step Node Types ─────────────────────────────────────────────

/** Discriminator for node execution dispatch. */
export type StepNodeType =
  | 'task'           // Invokes a tool or custom handler
  | 'condition'      // Evaluates a predicate, selects outbound edges
  | 'hitl_gate'      // Pauses for human approval
  | 'parallel_split' // Fork point — enables concurrent branches
  | 'parallel_join'  // Join point — waits for all/any inbound branches
  | 'sub_workflow'   // Delegates to a nested DAGWorkflow
  | 'start'          // Entry sentinel
  | 'end';           // Exit sentinel

// ── Conditional Predicates ──────────────────────────────────────

/**
 * A structured, serializable predicate the engine evaluates
 * without requiring caller-supplied functions.
 *
 * Supports simple comparisons, logical combinators, and
 * JSONPath-like field references into the ExecutionContext.
 */
export type ConditionalPredicate =
  | ComparisonPredicate
  | LogicalPredicate
  | ExpressionPredicate;

export interface ComparisonPredicate {
  type: 'comparison';
  /** JSONPath-like reference. e.g. "output.status", "ctx.vars.env" */
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'matches';
  value: unknown;
}

export interface LogicalPredicate {
  type: 'and' | 'or' | 'not';
  operands: ConditionalPredicate[];
}

/**
 * Escape hatch for complex predicates that can't be expressed
 * as simple comparisons. Evaluated in a sandboxed expression
 * evaluator (NOT `eval`).
 */
export interface ExpressionPredicate {
  type: 'expression';
  /** Safe expression string, e.g. "output.score > 0.8 && ctx.vars.env === 'prod'" */
  expr: string;
}

// ── Parameter Mapping ───────────────────────────────────────────

export interface ParameterMapping {
  /** Target parameter name on the tool. */
  param: string;

  /**
   * JSONPath-like expression resolved against ExecutionContext.
   * Examples:
   *   "ctx.vars.repoUrl"
   *   "ctx.nodeOutputs['fetch-repo'].data.commitSha"
   *   "ctx.secrets.GITHUB_TOKEN"
   */
  from: string;
}

// ── Step Node Configs (discriminated by StepNodeType) ───────────

export interface TaskNodeConfig {
  /** Tool Registry ID. If set, the engine invokes this tool. */
  toolId?: string;

  /**
   * Static parameters or dynamic mappings from ExecutionContext.
   * Static:  { "repo": "openspace", "branch": "main" }
   * Dynamic: [{ param: "branch", from: "ctx.inputs.branchName" }]
   */
  toolParams?: Record<string, unknown> | ParameterMapping[];

  /** Named handler for non-tool execution. */
  handler?: string;
}

export interface ConditionNodeConfig {
  predicate: ConditionalPredicate;
}

export interface HITLGateNodeConfig {
  escalationChainId?: string;
  prompt?: string;
}

export interface ParallelJoinNodeConfig {
  /** 'all' = wait for every inbound branch. 'any' = first to complete wins. */
  joinStrategy: 'all' | 'any';
}

export interface SubWorkflowNodeConfig {
  workflowId: string;
  inputMapping?: ParameterMapping[];
}

/** Union of all step node configs. */
export type StepNodeConfig =
  | TaskNodeConfig
  | ConditionNodeConfig
  | HITLGateNodeConfig
  | ParallelJoinNodeConfig
  | SubWorkflowNodeConfig
  | Record<string, unknown>; // start / end / parallel_split carry no config

// ── StepNode ────────────────────────────────────────────────────

/** A node in the enhanced DAG workflow. */
export interface StepNode {
  /** Unique within the workflow. Kebab-case recommended. */
  id: string;

  /** Human-readable label shown in the UI. */
  label: string;

  /** Discriminator for execution dispatch. */
  type: StepNodeType;

  /**
   * Type-specific configuration.
   * @see TaskNodeConfig, ConditionNodeConfig, HITLGateNodeConfig,
   *      ParallelJoinNodeConfig, SubWorkflowNodeConfig
   */
  config: StepNodeConfig;

  /** Maximum time (ms) this node may execute before being killed. */
  timeoutMs?: number;

  /** Number of automatic retries on transient failure. Default 0. */
  retries?: number;

  /** Delay (ms) between retries. Supports exponential backoff. */
  retryDelayMs?: number;

  /** What to do when this node fails after all retries. */
  onFailure?: 'fail_workflow' | 'skip' | 'continue';

  /**
   * Declarative interrupt policy. If set, the engine evaluates this after
   * node execution and before committing the output. If triggered, the node
   * pauses for human review.
   */
  interruptPolicy?: InterruptPolicy;

  /** Metadata for UI rendering (position, color, icon). */
  metadata?: Record<string, unknown>;
}

// ── Edge ────────────────────────────────────────────────────────

/** A directed edge in the DAG with optional conditional predicate. */
export interface Edge {
  /** Source node ID. */
  from: string;

  /** Target node ID. */
  to: string;

  /**
   * Optional predicate. If present, this edge is only traversed when the
   * predicate evaluates to true against the source node's output and the
   * ExecutionContext.
   *
   * Edges without a predicate are "default" — traversed when no sibling
   * predicate matches (like an else branch).
   */
  condition?: ConditionalPredicate;

  /**
   * Human-readable label for the edge (shown in UI on arrows).
   * e.g. "on success", "score > 0.8", "else"
   */
  label?: string;

  /** Execution priority when multiple edges are eligible. Lower = first. */
  priority?: number;
}

// ── DAGWorkflow (Definition) ────────────────────────────────────

/** A complete enhanced DAG workflow definition. */
export interface DAGWorkflow {
  /** Unique identifier for the workflow definition. */
  id: string;

  /** Human-readable name. */
  name: string;

  /** Semantic version string (major.minor.patch). */
  version: string;

  /** Optional description. */
  description?: string;

  /** All nodes in the graph. */
  nodes: StepNode[];

  /** All directed edges. */
  edges: Edge[];

  /**
   * Workflow-level variables available to all nodes via ExecutionContext.
   * Can be overridden at execution time.
   */
  defaultVars?: Record<string, unknown>;

  /**
   * Secrets the workflow requires (names only — values are injected
   * at runtime from a secure store, never serialized).
   */
  requiredSecrets?: string[];

  /** Maximum total execution time (ms) for the entire workflow. */
  timeoutMs?: number;

  /** Metadata for UI (layout positions, tags, etc). */
  metadata?: Record<string, unknown>;
}

// ── Node Output ─────────────────────────────────────────────────

export interface NodeOutput {
  /** The data returned by the node. */
  data: unknown;
  /** ISO-8601 completion timestamp. */
  completedAt: string;
  /** Duration in milliseconds. */
  durationMs: number;
}

// ── Tool Registry Reference ─────────────────────────────────────

/**
 * Minimal interface the workflow engine needs from the Tool Registry.
 * Avoids coupling to the full ToolRegistry class.
 */
export interface ToolRegistryRef {
  invoke(input: {
    toolId: string;
    parameters: Record<string, unknown>;
    timeout?: number;
  }): Promise<{
    success: boolean;
    data?: unknown;
    error?: { code: string; message: string };
    durationMs: number;
  }>;

  discover(filter?: {
    category?: string;
    name?: string;
  }): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
  }>;
}

// ── Execution Context ───────────────────────────────────────────

/**
 * The runtime context threaded through every node execution.
 * Provides access to workflow variables, predecessor outputs,
 * secrets, and the Tool Registry.
 *
 * Immutable — every update returns a new context.
 */
export interface ExecutionContext {
  /** The current workflow execution ID. */
  executionId: string;

  /** The workflow definition ID. */
  workflowId: string;

  /** The workflow definition version. */
  workflowVersion: string;

  /**
   * Workflow-level variables (merged: definition defaults → runtime overrides).
   * Mutable by nodes via `setVar()`.
   */
  vars: Record<string, unknown>;

  /**
   * Collected outputs from all completed nodes, keyed by node ID.
   * Populated automatically by the engine after each node completes.
   */
  nodeOutputs: Record<string, NodeOutput>;

  /**
   * Secret values, injected at workflow start from a secure provider.
   * Never serialized to checkpoints.
   */
  secrets: Record<string, string>;

  /**
   * Reference to the Tool Registry for dynamic tool discovery/invocation
   * within custom handlers. Not serialized.
   */
  toolRegistry: ToolRegistryRef;

  /** ISO-8601 timestamp when the execution started. */
  startedAt: string;

  /** Correlation ID for distributed tracing / logging. */
  traceId: string;
}

/**
 * Serializable subset of ExecutionContext.
 * Secrets and toolRegistry reference are excluded.
 */
export interface SerializedContext {
  vars: Record<string, unknown>;
  nodeOutputs: Record<string, NodeOutput>;
  startedAt: string;
  traceId: string;
}

// ── Enhanced Execution State ────────────────────────────────────

/** Execution status of a single node (extended). */
export type EnhancedNodeExecutionStatus =
  | 'pending'
  | 'queued'      // Scheduled for execution but not yet started
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'      // HITL gate waiting for human
  | 'skipped'     // Condition branch not taken
  | 'cancelled'   // Workflow cancelled while node was pending/running
  | 'retrying';   // Failed but retrying

/** Record of a single execution attempt for a node. */
export interface AttemptRecord {
  attempt: number;
  startedAt: string;
  completedAt: string;
  status: 'completed' | 'failed';
  output?: unknown;
  error?: string;
  durationMs: number;
}

/** Runtime state of a single node execution (enhanced). */
export interface EnhancedNodeExecutionState {
  /** Node ID this state refers to. */
  nodeId: string;
  /** Current execution status. */
  status: EnhancedNodeExecutionStatus;
  /** ISO-8601 timestamp when execution started (null if not started). */
  startedAt: string | null;
  /** ISO-8601 timestamp when execution completed (null if not done). */
  completedAt: string | null;
  /** Output data from execution (null if not completed). */
  output: unknown;
  /** Error message if failed. */
  error: string | null;
  /** For hitl_gate nodes: the escalation item ID. */
  escalationId: string | null;
  /** Current retry attempt (0-based). */
  attempt: number;
  /** History of all attempts (for debugging). */
  attempts: AttemptRecord[];
  /** Duration of the successful/final attempt in ms. */
  durationMs: number | null;
}

/** Workflow-level execution status (extended). */
export type EnhancedWorkflowExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timed_out';  // Workflow-level timeout exceeded

/** Runtime state of an entire workflow execution (enhanced). */
export interface EnhancedWorkflowExecutionState {
  /** Unique execution ID (different from workflow definition ID). */
  executionId: string;
  /** The workflow definition ID. */
  workflowId: string;
  /** Pins the definition version this execution started with. */
  workflowVersion: string;
  /** Overall execution status. */
  status: EnhancedWorkflowExecutionStatus;
  /** Per-node execution state. */
  nodeStates: Record<string, EnhancedNodeExecutionState>;
  /** Serializable subset of ExecutionContext (secrets excluded). */
  contextSnapshot: SerializedContext;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last update timestamp. */
  updatedAt: string;
  /** ISO-8601 completion timestamp (null if still running). */
  completedAt: string | null;
  /** Monotonically increasing checkpoint counter. */
  checkpointVersion: number;
  /**
   * Active (unresolved) interrupts for this execution.
   * Persisted atomically with the checkpoint. The workflow stays paused
   * until all entries are resolved.
   */
  activeInterrupts: InterruptState[];
}

// ── Checkpoint Store ────────────────────────────────────────────

/** Metadata for a single checkpoint version. */
export interface CheckpointMetadata {
  executionId: string;
  version: number;
  status: EnhancedWorkflowExecutionStatus;
  savedAt: string;
  sizeBytes: number;
}

/**
 * Persistence layer for workflow execution state.
 * Implementations: SQLite (local), Azure Blob (cloud), In-Memory (tests).
 */
export interface CheckpointStore {
  /**
   * Save a checkpoint. Implementations must be atomic —
   * a half-written checkpoint must not be visible to readers.
   */
  save(state: EnhancedWorkflowExecutionState): Promise<void>;

  /**
   * Load the latest checkpoint for a workflow execution.
   * Returns null if no checkpoint exists.
   */
  load(executionId: string): Promise<EnhancedWorkflowExecutionState | null>;

  /**
   * Load a specific checkpoint version.
   */
  loadVersion(executionId: string, version: number): Promise<EnhancedWorkflowExecutionState | null>;

  /**
   * List all checkpoint versions for an execution (metadata only).
   */
  listVersions(executionId: string): Promise<CheckpointMetadata[]>;

  /**
   * Delete all checkpoints for an execution (cleanup after completion).
   */
  delete(executionId: string): Promise<void>;

  /**
   * Delete checkpoint versions older than `keepLast` for an execution.
   * Prevents unbounded storage growth for long-running workflows.
   * Returns the number of pruned versions.
   */
  prune(executionId: string, keepLast: number): Promise<number>;
}

// ── Engine Events ───────────────────────────────────────────────

export type WorkflowEvent =
  | 'workflow:started'
  | 'workflow:completed'
  | 'workflow:failed'
  | 'workflow:paused'
  | 'workflow:resumed'
  | 'workflow:cancelled'
  | 'workflow:timed_out'
  | 'node:started'
  | 'node:completed'
  | 'node:failed'
  | 'node:retrying'
  | 'node:skipped'
  | 'node:paused'
  | 'checkpoint:saved';

export interface WorkflowEventPayload {
  executionId: string;
  workflowId: string;
  event: WorkflowEvent;
  nodeId?: string;
  timestamp: string;
  data?: unknown;
}

export type WorkflowEventHandler = (payload: WorkflowEventPayload) => void;

// ── Engine Config ───────────────────────────────────────────────

/** Handler function for executing a task node via custom logic. */
export type NodeHandler = (node: StepNode, ctx: ExecutionContext) => Promise<unknown>;

/**
 * Resolves a workflow definition by ID. Used by the engine to load
 * sub-workflow definitions during recursive execution.
 */
export type WorkflowResolver = (workflowId: string) => Promise<DAGWorkflow | null>;

/** Configuration for the DAGWorkflowEngine. */
export interface DAGWorkflowEngineConfig {
  /** Persistence layer for checkpoints. */
  checkpointStore: CheckpointStore;

  /** Tool Registry for tool invocation. */
  toolRegistry: ToolRegistryRef;

  /** Named custom handlers for non-tool task nodes. */
  handlers?: Record<string, NodeHandler>;

  /** HITL gate handler (creates escalation items). Returns escalation ID. */
  onHITLGate: (node: StepNode, executionId: string, ctx: ExecutionContext) => Promise<string>;

  /** Escalation resolution provider. */
  resolveEscalation: (escalationId: string) => Promise<{ approved: boolean; output?: unknown }>;

  /**
   * Resolves a workflow ID to a DAGWorkflow definition.
   * Required for sub_workflow node execution. If not provided,
   * sub_workflow nodes will fail with a configuration error.
   */
  workflowResolver?: WorkflowResolver;

  /** Maximum concurrent node executions. Default: 10. */
  maxConcurrency?: number;

  /** Maximum sub-workflow nesting depth. Default: 10. */
  maxSubWorkflowDepth?: number;

  /** Event listeners for observability. */
  eventListeners?: WorkflowEventHandler[];

  /** Optional tracer for span-based tracing instrumentation. */
  tracer?: Tracer;
}

/** Options for starting a new workflow execution. */
export interface WorkflowStartOptions {
  executionId?: string;
  vars?: Record<string, unknown>;
  secrets?: Record<string, string>;
  traceId?: string;
}

/** Resolution payload for resuming a paused execution. */
export interface EscalationResolution {
  escalationId: string;
  approved: boolean;
  output?: unknown;
}

/** Enhanced resolution payload using the full InterruptResolution model. */
export interface InterruptResolutionPayload {
  /** The interrupt ID to resolve. */
  interruptId: string;
  /** The human's decision. */
  resolution: InterruptResolution;
}
