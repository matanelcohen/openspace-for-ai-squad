/**
 * DAG Workflow types — directed acyclic graph workflow engine.
 *
 * Defines nodes, edges, and execution state for workflows that
 * can pause at HITL gates and resume after human approval.
 */

// ── Node Types ───────────────────────────────────────────────────

/** The type of a workflow node. */
export type WorkflowNodeType =
  | 'task'
  | 'hitl_gate'
  | 'condition'
  | 'parallel_split'
  | 'parallel_join'
  | 'sub_workflow'
  | 'start'
  | 'end';

/** Execution status of a single node. */
export type NodeExecutionStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'paused'
  | 'skipped';

/** Execution status of the overall workflow. */
export type WorkflowExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

// ── DAG Structure ────────────────────────────────────────────────

/** A node in the workflow DAG. */
export interface DAGNode {
  /** Unique identifier within the workflow. */
  id: string;
  /** Human-readable label. */
  label: string;
  /** What kind of node this is. */
  type: WorkflowNodeType;
  /** Configuration for this node (type-specific). */
  config: Record<string, unknown>;
}

/** An edge connecting two nodes in the DAG. */
export interface DAGEdge {
  /** Source node ID. */
  from: string;
  /** Target node ID. */
  to: string;
  /** Optional condition label (for condition nodes). */
  condition?: string;
}

/** A complete DAG workflow definition. */
export interface WorkflowDefinition {
  /** Unique identifier. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** All nodes. */
  nodes: DAGNode[];
  /** All edges. */
  edges: DAGEdge[];
}

// ── Execution State ──────────────────────────────────────────────

/** Runtime state of a single node execution. */
export interface NodeExecutionState {
  /** Node ID this state refers to. */
  nodeId: string;
  /** Current execution status. */
  status: NodeExecutionStatus;
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
}

/** Runtime state of an entire workflow execution. */
export interface WorkflowExecutionState {
  /** Unique execution ID (different from workflow definition ID). */
  executionId: string;
  /** The workflow definition ID. */
  workflowId: string;
  /** Overall execution status. */
  status: WorkflowExecutionStatus;
  /** Per-node execution state. */
  nodeStates: Record<string, NodeExecutionState>;
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last update timestamp. */
  updatedAt: string;
}
