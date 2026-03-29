/**
 * DAG Workflow Engine — Executes directed acyclic graph workflows
 * with support for HITL gates that pause execution until human approval.
 */

import type {
  DAGEdge,
  DAGNode,
  NodeExecutionState,
  NodeExecutionStatus,
  WorkflowDefinition,
  WorkflowExecutionState,
  WorkflowExecutionStatus,
} from '../types/workflow.js';

// ── Types ────────────────────────────────────────────────────────

/** Handler function for executing a task node. */
export type NodeExecutor = (
  node: DAGNode,
  inputs: Record<string, unknown>,
) => Promise<unknown>;

/** Handler function for evaluating a condition node. */
export type ConditionEvaluator = (
  node: DAGNode,
  inputs: Record<string, unknown>,
) => Promise<string>;

/** Callback when a HITL gate is reached. Returns the escalation item ID. */
export type HITLGateHandler = (
  node: DAGNode,
  workflowExecutionId: string,
) => Promise<string>;

/** Callback when an escalation is resolved (approved/rejected). */
export type EscalationResolutionHandler = (
  escalationId: string,
) => Promise<{ approved: boolean; output?: unknown }>;

export interface WorkflowEngineConfig {
  executeNode: NodeExecutor;
  evaluateCondition: ConditionEvaluator;
  onHITLGate: HITLGateHandler;
  resolveEscalation: EscalationResolutionHandler;
}

// ── Validation ───────────────────────────────────────────────────

/**
 * Validate a workflow definition for structural correctness.
 * Returns an array of error strings (empty if valid).
 */
export function validateWorkflow(def: WorkflowDefinition): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(def.nodes.map((n) => n.id));

  // Check for duplicate node IDs
  if (nodeIds.size !== def.nodes.length) {
    errors.push('Duplicate node IDs found');
  }

  // Validate edges reference existing nodes
  for (const edge of def.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references unknown source node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references unknown target node: ${edge.to}`);
    }
  }

  // Check for exactly one start node
  const startNodes = def.nodes.filter((n) => n.type === 'start');
  if (startNodes.length !== 1) {
    errors.push(`Expected exactly 1 start node, found ${startNodes.length}`);
  }

  // Check for at least one end node
  const endNodes = def.nodes.filter((n) => n.type === 'end');
  if (endNodes.length === 0) {
    errors.push('At least one end node is required');
  }

  // Check for cycles (topological sort)
  if (hasCycle(def.nodes, def.edges)) {
    errors.push('Workflow contains a cycle');
  }

  return errors;
}

/**
 * Detect cycles in a directed graph using DFS.
 */
export function hasCycle(nodes: DAGNode[], edges: DAGEdge[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    inStack.add(nodeId);

    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (dfs(neighbor)) return true;
    }

    inStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (dfs(node.id)) return true;
  }

  return false;
}

/**
 * Compute topological order of nodes.
 * Returns null if the graph has a cycle.
 */
export function topologicalSort(nodes: DAGNode[], edges: DAGEdge[]): string[] | null {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }
  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeId);
    for (const neighbor of adjacency.get(nodeId) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  return sorted.length === nodes.length ? sorted : null;
}

// ── Execution State Management ───────────────────────────────────

/**
 * Create the initial execution state for a workflow.
 */
export function createExecutionState(
  def: WorkflowDefinition,
  executionId?: string,
): WorkflowExecutionState {
  const now = new Date().toISOString();
  const nodeStates: Record<string, NodeExecutionState> = {};

  for (const node of def.nodes) {
    nodeStates[node.id] = {
      nodeId: node.id,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      output: null,
      error: null,
      escalationId: null,
    };
  }

  return {
    executionId: executionId ?? `exec-${Date.now()}`,
    workflowId: def.id,
    status: 'pending',
    nodeStates,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Get nodes that are ready to execute (all predecessors completed).
 */
export function getReadyNodes(
  def: WorkflowDefinition,
  state: WorkflowExecutionState,
): DAGNode[] {
  const ready: DAGNode[] = [];

  for (const node of def.nodes) {
    const nodeState = state.nodeStates[node.id];
    if (!nodeState || nodeState.status !== 'pending') continue;

    // Check all predecessor nodes are completed
    const predecessors = def.edges
      .filter((e) => e.to === node.id)
      .map((e) => e.from);

    const allPredecessorsCompleted = predecessors.every((predId) => {
      const predState = state.nodeStates[predId];
      return predState?.status === 'completed' || predState?.status === 'skipped';
    });

    if (allPredecessorsCompleted) {
      ready.push(node);
    }
  }

  return ready;
}

/**
 * Collect outputs from predecessor nodes as inputs for the current node.
 */
export function collectNodeInputs(
  nodeId: string,
  def: WorkflowDefinition,
  state: WorkflowExecutionState,
): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  const predecessors = def.edges
    .filter((e) => e.to === nodeId)
    .map((e) => e.from);

  for (const predId of predecessors) {
    inputs[predId] = state.nodeStates[predId]?.output ?? null;
  }

  return inputs;
}

/**
 * Update a node's execution state. Returns a new state (immutable).
 */
export function updateNodeState(
  state: WorkflowExecutionState,
  nodeId: string,
  update: Partial<NodeExecutionState>,
): WorkflowExecutionState {
  const existing = state.nodeStates[nodeId];
  if (!existing) {
    throw new Error(`Node "${nodeId}" not found in execution state`);
  }

  return {
    ...state,
    updatedAt: new Date().toISOString(),
    nodeStates: {
      ...state.nodeStates,
      [nodeId]: { ...existing, ...update },
    },
  };
}

/**
 * Determine the overall workflow status from node states.
 */
export function deriveWorkflowStatus(
  state: WorkflowExecutionState,
): WorkflowExecutionStatus {
  const statuses = Object.values(state.nodeStates).map((ns) => ns.status);

  if (statuses.some((s) => s === 'failed')) return 'failed';
  if (statuses.some((s) => s === 'paused')) return 'paused';
  if (statuses.some((s) => s === 'running')) return 'running';
  if (statuses.every((s) => s === 'completed' || s === 'skipped' || s === 'pending')) {
    // If all are completed/skipped, we're done. If some are still pending, we're running.
    if (statuses.some((s) => s === 'pending')) return 'running';
    return 'completed';
  }

  return 'running';
}

// ── Workflow Serialization ───────────────────────────────────────

/**
 * Serialize workflow execution state to a JSON-compatible string.
 */
export function serializeExecutionState(state: WorkflowExecutionState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize workflow execution state from a JSON string.
 */
export function deserializeExecutionState(json: string): WorkflowExecutionState {
  const parsed = JSON.parse(json);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid execution state: expected an object');
  }
  if (typeof parsed.executionId !== 'string') {
    throw new Error('Invalid execution state: missing executionId');
  }
  if (typeof parsed.workflowId !== 'string') {
    throw new Error('Invalid execution state: missing workflowId');
  }
  if (!parsed.nodeStates || typeof parsed.nodeStates !== 'object') {
    throw new Error('Invalid execution state: missing nodeStates');
  }

  return parsed as WorkflowExecutionState;
}

// ── Workflow Engine ──────────────────────────────────────────────

export class WorkflowEngine {
  private config: WorkflowEngineConfig;

  constructor(config: WorkflowEngineConfig) {
    this.config = config;
  }

  /**
   * Execute a workflow from the given state.
   * Processes nodes in topological order, pausing at HITL gates.
   * Returns the final execution state.
   */
  async execute(
    def: WorkflowDefinition,
    state: WorkflowExecutionState,
  ): Promise<WorkflowExecutionState> {
    const errors = validateWorkflow(def);
    if (errors.length > 0) {
      throw new Error(`Invalid workflow: ${errors.join('; ')}`);
    }

    let current = { ...state, status: 'running' as WorkflowExecutionStatus };

    while (true) {
      const readyNodes = getReadyNodes(def, current);
      if (readyNodes.length === 0) break;

      for (const node of readyNodes) {
        current = await this.executeNode(def, current, node);

        // If workflow is paused (hit a HITL gate), stop processing
        if (current.status === 'paused') {
          return current;
        }
        // If a node failed, stop
        if (current.nodeStates[node.id]?.status === 'failed') {
          current = { ...current, status: 'failed' };
          return current;
        }
      }
    }

    current = { ...current, status: deriveWorkflowStatus(current) };
    return current;
  }

  /**
   * Resume a paused workflow after an escalation is resolved.
   */
  async resume(
    def: WorkflowDefinition,
    state: WorkflowExecutionState,
    escalationId: string,
  ): Promise<WorkflowExecutionState> {
    if (state.status !== 'paused') {
      throw new Error(`Cannot resume workflow in status "${state.status}"`);
    }

    // Find the paused node
    const pausedEntry = Object.entries(state.nodeStates).find(
      ([, ns]) => ns.status === 'paused' && ns.escalationId === escalationId,
    );

    if (!pausedEntry) {
      throw new Error(`No paused node found for escalation "${escalationId}"`);
    }

    const [pausedNodeId] = pausedEntry;
    const resolution = await this.config.resolveEscalation(escalationId);

    let current: WorkflowExecutionState;
    if (resolution.approved) {
      current = updateNodeState(state, pausedNodeId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        output: resolution.output ?? { approved: true },
      });
    } else {
      current = updateNodeState(state, pausedNodeId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: 'Escalation rejected by reviewer',
        output: resolution.output ?? { approved: false },
      });
      return { ...current, status: 'failed' };
    }

    // Continue execution from where we left off
    return this.execute(def, current);
  }

  private async executeNode(
    def: WorkflowDefinition,
    state: WorkflowExecutionState,
    node: DAGNode,
  ): Promise<WorkflowExecutionState> {
    const inputs = collectNodeInputs(node.id, def, state);

    let current = updateNodeState(state, node.id, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });

    try {
      switch (node.type) {
        case 'start':
        case 'end':
          current = updateNodeState(current, node.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            output: inputs,
          });
          break;

        case 'task': {
          const output = await this.config.executeNode(node, inputs);
          current = updateNodeState(current, node.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            output,
          });
          break;
        }

        case 'hitl_gate': {
          const escalationId = await this.config.onHITLGate(node, state.executionId);
          current = updateNodeState(current, node.id, {
            status: 'paused',
            escalationId,
          });
          current = { ...current, status: 'paused' };
          break;
        }

        case 'condition': {
          const branch = await this.config.evaluateCondition(node, inputs);
          // Mark non-selected branches as skipped
          const outEdges = def.edges.filter((e) => e.from === node.id);
          for (const edge of outEdges) {
            if (edge.condition && edge.condition !== branch) {
              current = updateNodeState(current, edge.to, { status: 'skipped' });
            }
          }
          current = updateNodeState(current, node.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            output: { branch },
          });
          break;
        }

        case 'parallel_split':
        case 'parallel_join':
          current = updateNodeState(current, node.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            output: inputs,
          });
          break;

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }
    } catch (error) {
      if (current.status === 'paused') return current;

      const message = error instanceof Error ? error.message : String(error);
      current = updateNodeState(current, node.id, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: message,
      });
    }

    return current;
  }
}

// ── Re-exports: Enhanced DAG Engine ─────────────────────────────

export {
  deserializeState,
  InMemoryCheckpointStore,
  recoverState,
  serializeState,
} from './checkpoint.js';
export type { DAGBuilderOptions, StepInput } from './dag-builder.js';
export { DAGBuilder, DAGBuilderError } from './dag-builder.js';
export {
  DAGWorkflowEngine,
  getDAGReadyNodes,
  hasDAGCycle,
  topologicalLevels,
  validateDAGWorkflow,
} from './dag-engine.js';
export type { DAGExecutorConfig } from './dag-executor.js';
export { DAGExecutor } from './dag-executor.js';
export { resolvePath,resolveToolParams } from './parameter-resolver.js';
export { compareValues, evaluatePredicate, PredicateEvaluationError, resolveField } from './predicate-evaluator.js';
