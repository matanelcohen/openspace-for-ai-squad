/**
 * DAG Workflow Engine (v2) — Enhanced engine with parallel execution,
 * conditional edge predicates, checkpoint persistence, retry/timeout,
 * and Tool Registry integration.
 *
 * Replaces the serial execution loop in the original WorkflowEngine
 * while preserving backward compatibility with existing types.
 */

import type {
  CheckpointStore,
  DAGWorkflow,
  DAGWorkflowEngineConfig,
  Edge,
  EnhancedNodeExecutionState,
  EnhancedNodeExecutionStatus,
  EnhancedWorkflowExecutionState,
  EnhancedWorkflowExecutionStatus,
  EscalationResolution,
  ExecutionContext,
  InterruptResolutionPayload,
  NodeOutput,
  ParameterMapping,
  SerializedContext,
  StepNode,
  SubWorkflowNodeConfig,
  TaskNodeConfig,
  WorkflowEvent,
  WorkflowEventHandler,
  WorkflowEventPayload,
  WorkflowStartOptions,
} from '../types/dag-workflow.js';
import type {
  InterruptResolution,
  InterruptState,
  InterruptTimeoutPolicy,
} from '../types/interrupt.js';
import { recoverState } from './checkpoint.js';
import {
  createInterruptState,
  isInterruptError,
  shouldInterrupt,
} from './interrupt.js';
import { resolveToolParams, resolvePath } from './parameter-resolver.js';
import { evaluatePredicate } from './predicate-evaluator.js';

// ── Validation ──────────────────────────────────────────────────

/**
 * Validate a DAGWorkflow definition. Returns error strings (empty = valid).
 */
export function validateDAGWorkflow(def: DAGWorkflow): string[] {
  const errors: string[] = [];
  const nodeIds = new Set(def.nodes.map((n) => n.id));

  if (nodeIds.size !== def.nodes.length) {
    errors.push('Duplicate node IDs found');
  }

  for (const edge of def.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references unknown source node: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references unknown target node: ${edge.to}`);
    }
  }

  const startNodes = def.nodes.filter((n) => n.type === 'start');
  if (startNodes.length !== 1) {
    errors.push(`Expected exactly 1 start node, found ${startNodes.length}`);
  }

  const endNodes = def.nodes.filter((n) => n.type === 'end');
  if (endNodes.length === 0) {
    errors.push('At least one end node is required');
  }

  if (hasDAGCycle(def.nodes, def.edges)) {
    errors.push('Workflow contains a cycle');
  }

  return errors;
}

/**
 * Detect cycles using DFS with recursion stack. O(V+E).
 */
export function hasDAGCycle(nodes: StepNode[], edges: Edge[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const node of nodes) adjacency.set(node.id, []);
  for (const edge of edges) adjacency.get(edge.from)?.push(edge.to);

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
 * Compute topological levels — nodes at the same level can execute in parallel.
 */
export function topologicalLevels(nodes: StepNode[], edges: Edge[]): string[][] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
    inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
  }

  const levels: string[][] = [];
  let queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);

  while (queue.length > 0) {
    levels.push([...queue]);
    const next: string[] = [];
    for (const id of queue) {
      for (const neighbor of adj.get(id) ?? []) {
        const d = (inDegree.get(neighbor) ?? 1) - 1;
        inDegree.set(neighbor, d);
        if (d === 0) next.push(neighbor);
      }
    }
    queue = next;
  }

  return levels;
}

// ── Ready Node Detection ────────────────────────────────────────

/**
 * Determine if a node is ready to execute given current state.
 * Respects parallel_join strategies.
 */
function isNodeReady(
  nodeId: string,
  def: DAGWorkflow,
  state: EnhancedWorkflowExecutionState,
): boolean {
  const nodeState = state.nodeStates[nodeId];
  if (!nodeState || nodeState.status !== 'pending') return false;

  const inbound = def.edges.filter((e) => e.to === nodeId);
  if (inbound.length === 0) return true; // root node

  const node = def.nodes.find((n) => n.id === nodeId);

  if (
    node?.type === 'parallel_join' &&
    (node.config as { joinStrategy?: string }).joinStrategy === 'any'
  ) {
    return inbound.some((e) => {
      const s = state.nodeStates[e.from]?.status;
      return s === 'completed';
    });
  }

  // Default: all predecessors must be terminal
  return inbound.every((e) => {
    const s = state.nodeStates[e.from]?.status;
    return s === 'completed' || s === 'skipped' || s === 'cancelled';
  });
}

/**
 * Get all nodes that are ready to execute.
 */
export function getDAGReadyNodes(
  def: DAGWorkflow,
  state: EnhancedWorkflowExecutionState,
): StepNode[] {
  return def.nodes.filter((n) => isNodeReady(n.id, def, state));
}

// ── State Helpers ───────────────────────────────────────────────

function createInitialNodeState(nodeId: string): EnhancedNodeExecutionState {
  return {
    nodeId,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    output: null,
    error: null,
    escalationId: null,
    attempt: 0,
    attempts: [],
    durationMs: null,
  };
}

function updateNodeState(
  state: EnhancedWorkflowExecutionState,
  nodeId: string,
  update: Partial<EnhancedNodeExecutionState>,
): EnhancedWorkflowExecutionState {
  const existing = state.nodeStates[nodeId];
  if (!existing) throw new Error(`Node "${nodeId}" not found in execution state`);

  return {
    ...state,
    updatedAt: new Date().toISOString(),
    nodeStates: {
      ...state.nodeStates,
      [nodeId]: { ...existing, ...update },
    },
  };
}

function deriveStatus(state: EnhancedWorkflowExecutionState): EnhancedWorkflowExecutionStatus {
  const statuses = Object.values(state.nodeStates).map((ns) => ns.status);

  if (statuses.some((s) => s === 'failed')) return 'failed';
  if (statuses.some((s) => s === 'paused')) return 'paused';
  if (statuses.some((s) => s === 'running' || s === 'retrying' || s === 'queued')) return 'running';
  if (statuses.every((s) => s === 'completed' || s === 'skipped' || s === 'cancelled')) {
    return 'completed';
  }
  if (statuses.some((s) => s === 'pending')) return 'running';

  return 'running';
}

function snapshotContext(ctx: ExecutionContext): SerializedContext {
  return {
    vars: { ...ctx.vars },
    nodeOutputs: { ...ctx.nodeOutputs },
    startedAt: ctx.startedAt,
    traceId: ctx.traceId,
  };
}

// ── Timeout Utility ─────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    promise.then(
      (val) => { clearTimeout(timer); resolve(val); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── DAG Workflow Engine ─────────────────────────────────────────

export class DAGWorkflowEngine {
  private config: DAGWorkflowEngineConfig;
  private listeners: WorkflowEventHandler[] = [];
  private currentDepth: number;

  constructor(config: DAGWorkflowEngineConfig, depth = 0) {
    this.config = config;
    this.currentDepth = depth;
    if (config.eventListeners) {
      this.listeners.push(...config.eventListeners);
    }
  }

  /** Validate a workflow definition. Returns errors (empty = valid). */
  validate(workflow: DAGWorkflow): string[] {
    return validateDAGWorkflow(workflow);
  }

  /** Subscribe to execution events. */
  on(_event: WorkflowEvent, handler: WorkflowEventHandler): void {
    this.listeners.push(handler);
  }

  /** Start a new workflow execution. */
  async start(
    workflow: DAGWorkflow,
    options?: WorkflowStartOptions,
  ): Promise<EnhancedWorkflowExecutionState> {
    const errors = validateDAGWorkflow(workflow);
    if (errors.length > 0) {
      throw new Error(`Invalid workflow: ${errors.join('; ')}`);
    }

    const executionId = options?.executionId ?? `exec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    // Build initial node states
    const nodeStates: Record<string, EnhancedNodeExecutionState> = {};
    for (const node of workflow.nodes) {
      nodeStates[node.id] = createInitialNodeState(node.id);
    }

    // Build execution context
    const ctx: ExecutionContext = {
      executionId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      vars: { ...(workflow.defaultVars ?? {}), ...(options?.vars ?? {}) },
      nodeOutputs: {},
      secrets: options?.secrets ?? {},
      toolRegistry: this.config.toolRegistry,
      startedAt: now,
      traceId: options?.traceId ?? `trace-${Date.now()}`,
    };

    // Build initial state
    const state: EnhancedWorkflowExecutionState = {
      executionId,
      workflowId: workflow.id,
      workflowVersion: workflow.version,
      status: 'running',
      nodeStates,
      contextSnapshot: snapshotContext(ctx),
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      checkpointVersion: 0,
      activeInterrupts: [],
    };

    // Checkpoint v0
    await this.checkpoint(state);
    this.emit('workflow:started', state);

    // Execute — wrapped in a root tracing span if tracer is available
    const tracer = this.config.tracer;
    if (tracer) {
      return tracer.withSpan('dag.workflow', 'internal', async (spanCtx) => {
        tracer.setAttributes(spanCtx.spanId, {
          'workflow.id': workflow.id,
          'workflow.version': workflow.version,
          'workflow.execution_id': executionId,
          'workflow.node_count': workflow.nodes.length,
          'workflow.edge_count': workflow.edges.length,
          'workflow.trace_id': ctx.traceId,
        });

        const result = await this.runLoop(workflow, state, ctx);

        tracer.setAttributes(spanCtx.spanId, {
          'workflow.status': result.status,
          'workflow.checkpoint_version': result.checkpointVersion,
        });
        return result;
      });
    }

    return this.runLoop(workflow, state, ctx);
  }

  /** Resume a paused execution after HITL approval. */
  async resume(
    workflow: DAGWorkflow,
    executionId: string,
    resolution: EscalationResolution,
  ): Promise<EnhancedWorkflowExecutionState> {
    let state = await this.config.checkpointStore.load(executionId);
    if (!state) throw new Error(`No checkpoint found for execution "${executionId}"`);
    if (state.status !== 'paused') {
      throw new Error(`Cannot resume execution in status "${state.status}"`);
    }

    // Find the paused node
    const pausedEntry = Object.entries(state.nodeStates).find(
      ([, ns]) => ns.status === 'paused' && ns.escalationId === resolution.escalationId,
    );
    if (!pausedEntry) {
      throw new Error(`No paused node found for escalation "${resolution.escalationId}"`);
    }

    const [pausedNodeId] = pausedEntry;

    if (resolution.approved) {
      state = updateNodeState(state, pausedNodeId, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        output: resolution.output ?? { approved: true },
      });
    } else {
      state = updateNodeState(state, pausedNodeId, {
        status: 'failed',
        completedAt: new Date().toISOString(),
        error: 'Escalation rejected by reviewer',
        output: resolution.output ?? { approved: false },
      });
      state = { ...state, status: 'failed', completedAt: new Date().toISOString() };
      await this.checkpoint(state);
      this.emit('workflow:failed', state);
      return state;
    }

    // Rebuild context from snapshot
    const ctx = this.rebuildContext(state, workflow);
    this.emit('workflow:resumed', state);

    return this.runLoop(workflow, state, ctx);
  }

  /** Cancel a running or paused execution. */
  async cancel(executionId: string): Promise<EnhancedWorkflowExecutionState> {
    let state = await this.config.checkpointStore.load(executionId);
    if (!state) throw new Error(`No checkpoint found for execution "${executionId}"`);

    // Cancel all non-terminal nodes
    for (const [nodeId, ns] of Object.entries(state.nodeStates)) {
      if (ns.status === 'pending' || ns.status === 'queued' || ns.status === 'running' || ns.status === 'paused') {
        state = updateNodeState(state, nodeId, {
          status: 'cancelled',
          completedAt: new Date().toISOString(),
        });
      }
    }

    state = { ...state, status: 'cancelled', completedAt: new Date().toISOString() };
    await this.checkpoint(state);
    this.emit('workflow:cancelled', state);
    return state;
  }

  /** Get the current state of an execution from the checkpoint store. */
  async getState(executionId: string): Promise<EnhancedWorkflowExecutionState | null> {
    return this.config.checkpointStore.load(executionId);
  }

  // ── Private: Main Execution Loop ──────────────────────────────

  private async runLoop(
    def: DAGWorkflow,
    initialState: EnhancedWorkflowExecutionState,
    ctx: ExecutionContext,
  ): Promise<EnhancedWorkflowExecutionState> {
    let state = initialState;
    const maxConcurrency = this.config.maxConcurrency ?? 10;
    const tracer = this.config.tracer;

    // Check workflow-level timeout
    const workflowDeadline = def.timeoutMs
      ? Date.parse(state.createdAt) + def.timeoutMs
      : Infinity;

    while (true) {
      // Check workflow timeout
      if (Date.now() > workflowDeadline) {
        state = { ...state, status: 'timed_out', completedAt: new Date().toISOString() };
        await this.checkpoint(state);
        tracer?.recordEvent(
          tracer.startSpan('dag.workflow.timeout', 'internal', {
            'workflow.execution_id': state.executionId,
            'workflow.deadline_ms': def.timeoutMs,
          }).spanId,
          'workflow.timed_out',
        );
        this.emit('workflow:timed_out', state);
        return state;
      }

      const readyNodes = getDAGReadyNodes(def, state);
      if (readyNodes.length === 0) break;

      // Execute ready nodes in parallel batches (respecting concurrency limit)
      const batches = chunkArray(readyNodes, maxConcurrency);

      for (const batch of batches) {
        const executeBatch = async () => {
          const results = await Promise.allSettled(
            batch.map(async (node) => {
              const result = await this.executeNode(def, state, node, ctx);
              return { nodeId: node.id, state: result.state, ctx: result.ctx };
            }),
          );

          // Merge results back into state
          for (const result of results) {
            if (result.status === 'fulfilled') {
              const { nodeId, state: nodeState, ctx: updatedCtx } = result.value;
              // Merge node state
              state = {
                ...state,
                updatedAt: new Date().toISOString(),
                nodeStates: {
                  ...state.nodeStates,
                  [nodeId]: nodeState.nodeStates[nodeId]!,
                },
              };
              // Merge context (node outputs, vars)
              ctx.nodeOutputs = { ...ctx.nodeOutputs, ...updatedCtx.nodeOutputs };
              ctx.vars = { ...ctx.vars, ...updatedCtx.vars };
            }
          }
        };

        // Wrap batch in a span if tracer is available
        if (tracer) {
          await tracer.withSpan('dag.batch', 'internal', async (spanCtx) => {
            tracer.setAttributes(spanCtx.spanId, {
              'batch.size': batch.length,
              'batch.node_ids': batch.map((n) => n.id),
              'batch.node_types': batch.map((n) => n.type),
            });
            await executeBatch();
          });
        } else {
          await executeBatch();
        }

        // Evaluate outbound edge predicates for completed condition nodes
        for (const node of batch) {
          const ns = state.nodeStates[node.id];
          if (ns?.status === 'completed' && node.type === 'condition') {
            state = this.evaluateOutboundEdges(def, state, node, ctx);
          }
        }

        // Update context snapshot
        state = { ...state, contextSnapshot: snapshotContext(ctx) };

        // Checkpoint after each batch
        state = { ...state, checkpointVersion: state.checkpointVersion + 1 };
        await this.checkpoint(state);

        // Check for pause
        if (Object.values(state.nodeStates).some((ns) => ns.status === 'paused')) {
          state = { ...state, status: 'paused' };
          await this.checkpoint(state);
          this.emit('workflow:paused', state);
          return state;
        }

        // Check for failure with fail_workflow policy
        for (const node of batch) {
          const ns = state.nodeStates[node.id];
          if (ns?.status === 'failed' && (node.onFailure ?? 'fail_workflow') === 'fail_workflow') {
            state = { ...state, status: 'failed', completedAt: new Date().toISOString() };
            await this.checkpoint(state);
            this.emit('workflow:failed', state);
            return state;
          }
        }
      }
    }

    // Derive final status
    const finalStatus = deriveStatus(state);
    state = {
      ...state,
      status: finalStatus,
      completedAt: finalStatus === 'completed' || finalStatus === 'failed'
        ? new Date().toISOString()
        : null,
    };
    await this.checkpoint(state);

    if (finalStatus === 'completed') {
      this.emit('workflow:completed', state);
    } else if (finalStatus === 'failed') {
      this.emit('workflow:failed', state);
    }

    return state;
  }

  // ── Private: Node Execution ───────────────────────────────────

  private async executeNode(
    def: DAGWorkflow,
    state: EnhancedWorkflowExecutionState,
    node: StepNode,
    ctx: ExecutionContext,
  ): Promise<{ state: EnhancedWorkflowExecutionState; ctx: ExecutionContext }> {
    const tracer = this.config.tracer;

    const executeNodeInner = async (): Promise<{ state: EnhancedWorkflowExecutionState; ctx: ExecutionContext }> => {
    let current = updateNodeState(state, node.id, {
      status: 'running',
      startedAt: new Date().toISOString(),
    });
    this.emit('node:started', current, node.id);

    try {
      switch (node.type) {
        case 'start':
        case 'end':
        case 'parallel_split': {
          current = updateNodeState(current, node.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            output: {},
            durationMs: 0,
            attempts: [{ attempt: 0, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: 'completed', durationMs: 0 }],
          });
          this.emit('node:completed', current, node.id);
          break;
        }

        case 'parallel_join': {
          // Collect outputs from all inbound predecessors
          const inbound = def.edges.filter((e) => e.to === node.id);
          const joinedOutput: Record<string, unknown> = {};
          for (const edge of inbound) {
            joinedOutput[edge.from] = ctx.nodeOutputs[edge.from]?.data ?? null;
          }
          current = updateNodeState(current, node.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            output: joinedOutput,
            durationMs: 0,
            attempts: [{ attempt: 0, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: 'completed', durationMs: 0 }],
          });
          // If join strategy is 'any', cancel remaining running branches
          if ((node.config as { joinStrategy?: string }).joinStrategy === 'any') {
            for (const edge of inbound) {
              const predState = current.nodeStates[edge.from];
              if (predState && predState.status !== 'completed' && predState.status !== 'failed') {
                current = updateNodeState(current, edge.from, { status: 'cancelled', completedAt: new Date().toISOString() });
              }
            }
          }
          this.emit('node:completed', current, node.id);
          break;
        }

        case 'task': {
          const result = await this.executeTaskWithRetry(node, ctx);
          if (result.status === 'completed') {
            const nodeOutput: NodeOutput = {
              data: result.output,
              completedAt: new Date().toISOString(),
              durationMs: result.durationMs,
            };
            ctx = { ...ctx, nodeOutputs: { ...ctx.nodeOutputs, [node.id]: nodeOutput } };
            current = updateNodeState(current, node.id, {
              status: 'completed',
              completedAt: new Date().toISOString(),
              output: result.output,
              durationMs: result.durationMs,
              attempts: result.attempts,
              attempt: result.attempts.length - 1,
            });
            this.emit('node:completed', current, node.id);
          } else {
            current = this.handleNodeFailure(current, node, result.error ?? 'Unknown error', result.attempts);
          }
          break;
        }

        case 'hitl_gate': {
          const escalationId = await this.config.onHITLGate(node, state.executionId, ctx);
          current = updateNodeState(current, node.id, {
            status: 'paused',
            escalationId,
          });
          this.emit('node:paused', current, node.id);
          break;
        }

        case 'condition': {
          // Condition nodes are passthrough — evaluation happens in edge traversal
          current = updateNodeState(current, node.id, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            output: {},
            durationMs: 0,
            attempts: [{ attempt: 0, startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), status: 'completed', durationMs: 0 }],
          });
          this.emit('node:completed', current, node.id);
          break;
        }

        case 'sub_workflow': {
          const subResult = await this.executeSubWorkflow(node, ctx, state);
          if (subResult.status === 'completed') {
            const nodeOutput: NodeOutput = {
              data: subResult.output,
              completedAt: new Date().toISOString(),
              durationMs: subResult.durationMs,
            };
            ctx = { ...ctx, nodeOutputs: { ...ctx.nodeOutputs, [node.id]: nodeOutput } };
            current = updateNodeState(current, node.id, {
              status: 'completed',
              completedAt: new Date().toISOString(),
              output: subResult.output,
              durationMs: subResult.durationMs,
              attempts: [{
                attempt: 0,
                startedAt: subResult.startedAt,
                completedAt: new Date().toISOString(),
                status: 'completed',
                output: subResult.output,
                durationMs: subResult.durationMs,
              }],
            });
            this.emit('node:completed', current, node.id);
          } else if (subResult.status === 'paused') {
            current = updateNodeState(current, node.id, {
              status: 'paused',
              escalationId: subResult.escalationId ?? null,
            });
            this.emit('node:paused', current, node.id);
          } else {
            current = this.handleNodeFailure(current, node, subResult.error ?? 'Sub-workflow failed', [{
              attempt: 0,
              startedAt: subResult.startedAt,
              completedAt: new Date().toISOString(),
              status: 'failed',
              error: subResult.error,
              durationMs: subResult.durationMs,
            }]);
          }
          break;
        }

        default:
          throw new Error(`Unknown node type: ${node.type}`);
      }
    } catch (error) {
      if (current.nodeStates[node.id]?.status === 'paused') {
        return { state: current, ctx };
      }
      const message = error instanceof Error ? error.message : String(error);
      current = this.handleNodeFailure(current, node, message, []);
    }

    return { state: current, ctx };
    };

    // Wrap in a per-node span if tracer is available
    if (tracer) {
      return tracer.withSpan(`dag.node.${node.type}`, 'internal', async (spanCtx) => {
        tracer.setAttributes(spanCtx.spanId, {
          'node.id': node.id,
          'node.type': node.type,
          'node.label': node.label ?? node.id,
          'workflow.execution_id': ctx.executionId,
        });
        const result = await executeNodeInner();
        const finalStatus = result.state.nodeStates[node.id]?.status ?? 'unknown';
        tracer.setAttributes(spanCtx.spanId, {
          'node.status': finalStatus,
          'node.duration_ms': result.state.nodeStates[node.id]?.durationMs ?? 0,
        });
        return result;
      });
    }

    return executeNodeInner();
  }

  // ── Private: Sub-Workflow Execution ────────────────────────────

  private async executeSubWorkflow(
    node: StepNode,
    ctx: ExecutionContext,
    _parentState: EnhancedWorkflowExecutionState,
  ): Promise<{
    status: 'completed' | 'failed' | 'paused';
    output?: unknown;
    error?: string;
    durationMs: number;
    startedAt: string;
    escalationId?: string;
  }> {
    const maxDepth = this.config.maxSubWorkflowDepth ?? 10;
    if (this.currentDepth >= maxDepth) {
      return {
        status: 'failed',
        error: `Sub-workflow nesting depth exceeded maximum of ${maxDepth}`,
        durationMs: 0,
        startedAt: new Date().toISOString(),
      };
    }

    const config = node.config as SubWorkflowNodeConfig;
    if (!config.workflowId) {
      return {
        status: 'failed',
        error: `Sub-workflow node "${node.id}" missing workflowId in config`,
        durationMs: 0,
        startedAt: new Date().toISOString(),
      };
    }

    if (!this.config.workflowResolver) {
      return {
        status: 'failed',
        error: `Sub-workflow node "${node.id}" requires a workflowResolver in engine config`,
        durationMs: 0,
        startedAt: new Date().toISOString(),
      };
    }

    const startedAt = new Date().toISOString();
    const start = Date.now();

    try {
      const subWorkflow = await this.config.workflowResolver(config.workflowId);
      if (!subWorkflow) {
        return {
          status: 'failed',
          error: `Sub-workflow "${config.workflowId}" not found`,
          durationMs: Date.now() - start,
          startedAt,
        };
      }

      // Resolve input mapping to build sub-workflow vars
      const subVars: Record<string, unknown> = { ...(subWorkflow.defaultVars ?? {}) };
      if (config.inputMapping) {
        for (const mapping of config.inputMapping) {
          subVars[mapping.param] = resolvePath(mapping.from, ctx);
        }
      }

      // Create a child engine at depth + 1 sharing config but with its own depth counter
      const childEngine = new DAGWorkflowEngine(this.config, this.currentDepth + 1);

      // Forward event listeners from parent
      for (const listener of this.listeners) {
        childEngine.on('workflow:started', listener);
      }

      // Generate a scoped execution ID for the sub-workflow
      const subExecutionId = `${ctx.executionId}::sub::${node.id}::${Date.now()}`;

      const subState = await childEngine.start(subWorkflow, {
        executionId: subExecutionId,
        vars: subVars,
        secrets: ctx.secrets,
        traceId: ctx.traceId,
      });

      const durationMs = Date.now() - start;

      if (subState.status === 'completed') {
        // Collect outputs from end nodes of the sub-workflow
        const endNodeOutputs: Record<string, unknown> = {};
        for (const [nid, ns] of Object.entries(subState.nodeStates)) {
          if (ns.status === 'completed' && ns.output != null) {
            endNodeOutputs[nid] = ns.output;
          }
        }
        return {
          status: 'completed',
          output: {
            subWorkflowId: config.workflowId,
            subExecutionId,
            nodeOutputs: endNodeOutputs,
            vars: subState.contextSnapshot.vars,
          },
          durationMs,
          startedAt,
        };
      }

      if (subState.status === 'paused') {
        // Find the escalation ID from the paused sub-workflow
        const pausedNode = Object.values(subState.nodeStates).find((ns) => ns.status === 'paused');
        return {
          status: 'paused',
          durationMs,
          startedAt,
          escalationId: pausedNode?.escalationId ?? undefined,
        };
      }

      // Failed or other terminal status
      const failedNode = Object.values(subState.nodeStates).find((ns) => ns.status === 'failed');
      return {
        status: 'failed',
        error: failedNode?.error ?? `Sub-workflow "${config.workflowId}" finished with status: ${subState.status}`,
        durationMs,
        startedAt,
      };
    } catch (err) {
      return {
        status: 'failed',
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
        startedAt,
      };
    }
  }

  // ── Private: Task Execution with Retry ────────────────────────

  private async executeTaskWithRetry(
    node: StepNode,
    ctx: ExecutionContext,
  ): Promise<{
    status: 'completed' | 'failed';
    output?: unknown;
    error?: string;
    durationMs: number;
    attempts: EnhancedNodeExecutionState['attempts'];
  }> {
    const config = node.config as TaskNodeConfig;
    const maxAttempts = (node.retries ?? 0) + 1;
    const attempts: EnhancedNodeExecutionState['attempts'] = [];
    let totalDuration = 0;
    const tracer = this.config.tracer;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0) {
        this.emit('node:retrying', {} as EnhancedWorkflowExecutionState, node.id);
        const delay = (node.retryDelayMs ?? 1000) * Math.pow(2, attempt - 1);
        await sleep(delay);
      }

      const start = Date.now();
      try {
        let output: unknown;

        if (config.toolId) {
          const params = resolveToolParams(config.toolParams, ctx);

          const invokeToolCall = async () => {
            const result = await withTimeout(
              ctx.toolRegistry.invoke({
                toolId: config.toolId!,
                parameters: params,
                timeout: node.timeoutMs,
              }),
              node.timeoutMs ?? 30_000,
            );
            if (!result.success) {
              throw new Error(result.error?.message ?? `Tool "${config.toolId}" failed`);
            }
            return result.data;
          };

          // Wrap tool invocation in a tracing span
          if (tracer) {
            output = await tracer.withSpan(`tool:${config.toolId}`, 'tool', async (spanCtx) => {
              tracer.setAttributes(spanCtx.spanId, {
                'tool.id': config.toolId!,
                'tool.name': config.toolId!,
                'tool.input': params,
                'tool.timeout_ms': node.timeoutMs ?? 30_000,
                'tool.attempt': attempt,
                'tool.max_attempts': maxAttempts,
                'node.id': node.id,
                'workflow.execution_id': ctx.executionId,
              });
              const toolStart = performance.now();
              const data = await invokeToolCall();
              const toolDurationMs = performance.now() - toolStart;
              tracer.setAttributes(spanCtx.spanId, {
                'tool.output': data,
                'tool.duration_ms': Math.round(toolDurationMs * 100) / 100,
              });
              return data;
            });
          } else {
            output = await invokeToolCall();
          }
        } else if (config.handler) {
          const handler = this.config.handlers?.[config.handler];
          if (!handler) throw new Error(`Unknown handler: "${config.handler}"`);

          if (tracer) {
            output = await tracer.withSpan(`handler:${config.handler}`, 'internal', async (spanCtx) => {
              tracer.setAttributes(spanCtx.spanId, {
                'handler.name': config.handler!,
                'handler.attempt': attempt,
                'node.id': node.id,
              });
              return withTimeout(handler(node, ctx), node.timeoutMs ?? 30_000);
            });
          } else {
            output = await withTimeout(handler(node, ctx), node.timeoutMs ?? 30_000);
          }
        } else {
          throw new Error(`Task node "${node.id}" has neither toolId nor handler`);
        }

        const durationMs = Date.now() - start;
        totalDuration += durationMs;
        attempts.push({
          attempt,
          startedAt: new Date(start).toISOString(),
          completedAt: new Date().toISOString(),
          status: 'completed',
          output,
          durationMs,
        });

        return { status: 'completed', output, durationMs: totalDuration, attempts };
      } catch (err) {
        const durationMs = Date.now() - start;
        totalDuration += durationMs;

        const isTimeout = err instanceof Error && /timed?\s*out|timeout/i.test(err.message);
        const errorMessage = err instanceof Error ? err.message : String(err);

        // Record retry attempt as a tracing event
        if (tracer) {
          const retrySpanCtx = tracer.startSpan(`dag.retry.attempt`, 'internal', {
            'retry.attempt': attempt,
            'retry.node_id': node.id,
            'retry.error': errorMessage,
            'retry.is_timeout': isTimeout,
            'retry.duration_ms': durationMs,
          });
          if (err instanceof Error && err.stack) {
            tracer.setAttributes(retrySpanCtx.spanId, {
              'exception.stacktrace': err.stack,
            });
          }
          tracer.endSpan(retrySpanCtx.spanId, 'error');
        }

        attempts.push({
          attempt,
          startedAt: new Date(start).toISOString(),
          completedAt: new Date().toISOString(),
          status: 'failed',
          error: errorMessage,
          durationMs,
        });
      }
    }

    return {
      status: 'failed',
      error: attempts.at(-1)?.error ?? 'Unknown error',
      durationMs: totalDuration,
      attempts,
    };
  }

  // ── Private: Edge Evaluation ──────────────────────────────────

  private evaluateOutboundEdges(
    def: DAGWorkflow,
    state: EnhancedWorkflowExecutionState,
    node: StepNode,
    ctx: ExecutionContext,
  ): EnhancedWorkflowExecutionState {
    const outEdges = def.edges.filter((e) => e.from === node.id);
    const nodeOutput = state.nodeStates[node.id]?.output;

    // Separate edges with predicates from default edges
    const predicateEdges = outEdges.filter((e) => e.condition);
    const defaultEdges = outEdges.filter((e) => !e.condition);

    // Evaluate predicate edges (sorted by priority)
    const sorted = [...predicateEdges].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    const activeTargets = new Set<string>();

    for (const edge of sorted) {
      try {
        if (edge.condition && evaluatePredicate(edge.condition, nodeOutput, ctx)) {
          activeTargets.add(edge.to);
        }
      } catch {
        // Predicate evaluation failure → treat edge as inactive
      }
    }

    // If no predicate matched, activate default edges
    if (activeTargets.size === 0) {
      for (const edge of defaultEdges) {
        activeTargets.add(edge.to);
      }
    }

    // Skip nodes that aren't reachable
    let current = state;
    for (const edge of outEdges) {
      if (!activeTargets.has(edge.to)) {
        current = this.skipNodeRecursive(def, current, edge.to);
      }
    }

    return current;
  }

  private skipNodeRecursive(
    def: DAGWorkflow,
    state: EnhancedWorkflowExecutionState,
    nodeId: string,
  ): EnhancedWorkflowExecutionState {
    const ns = state.nodeStates[nodeId];
    if (!ns || ns.status !== 'pending') return state;

    let current = updateNodeState(state, nodeId, {
      status: 'skipped',
      completedAt: new Date().toISOString(),
    });
    this.emit('node:skipped', current, nodeId);

    // Recursively skip successors
    const successors = def.edges.filter((e) => e.from === nodeId);
    for (const edge of successors) {
      current = this.skipNodeRecursive(def, current, edge.to);
    }

    return current;
  }

  // ── Private: Failure Handling ─────────────────────────────────

  private handleNodeFailure(
    state: EnhancedWorkflowExecutionState,
    node: StepNode,
    error: string,
    attempts: EnhancedNodeExecutionState['attempts'],
  ): EnhancedWorkflowExecutionState {
    const policy = node.onFailure ?? 'fail_workflow';

    switch (policy) {
      case 'skip': {
        const current = updateNodeState(state, node.id, {
          status: 'skipped',
          completedAt: new Date().toISOString(),
          error,
          attempts,
        });
        this.emit('node:skipped', current, node.id);
        return current;
      }
      case 'continue': {
        const current = updateNodeState(state, node.id, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          output: null,
          error,
          attempts,
        });
        this.emit('node:completed', current, node.id);
        return current;
      }
      case 'fail_workflow':
      default: {
        const current = updateNodeState(state, node.id, {
          status: 'failed',
          completedAt: new Date().toISOString(),
          error,
          attempts,
        });
        this.emit('node:failed', current, node.id);
        return current;
      }
    }
  }

  // ── Private: Context Rebuild ──────────────────────────────────

  private rebuildContext(
    state: EnhancedWorkflowExecutionState,
    workflow: DAGWorkflow,
  ): ExecutionContext {
    const snapshot = state.contextSnapshot;
    return {
      executionId: state.executionId,
      workflowId: state.workflowId,
      workflowVersion: state.workflowVersion,
      vars: { ...snapshot.vars },
      nodeOutputs: { ...snapshot.nodeOutputs },
      secrets: {}, // Secrets must be re-injected by the caller
      toolRegistry: this.config.toolRegistry,
      startedAt: snapshot.startedAt,
      traceId: snapshot.traceId,
    };
  }

  // ── Private: Checkpoint ───────────────────────────────────────

  private async checkpoint(state: EnhancedWorkflowExecutionState): Promise<void> {
    await this.config.checkpointStore.save(state);
    // Record checkpoint as a tracing event
    const tracer = this.config.tracer;
    if (tracer) {
      const spanCtx = tracer.startSpan('dag.checkpoint', 'internal', {
        'checkpoint.version': state.checkpointVersion,
        'checkpoint.workflow_status': state.status,
        'workflow.execution_id': state.executionId,
      });
      tracer.endSpan(spanCtx.spanId, 'ok');
    }
    this.emit('checkpoint:saved', state);
  }

  // ── Private: Events ───────────────────────────────────────────

  private emit(
    event: WorkflowEvent,
    state: EnhancedWorkflowExecutionState,
    nodeId?: string,
  ): void {
    const payload: WorkflowEventPayload = {
      executionId: state.executionId,
      workflowId: state.workflowId,
      event,
      nodeId,
      timestamp: new Date().toISOString(),
    };
    for (const listener of this.listeners) {
      try {
        listener(payload);
      } catch {
        // Don't let event handler errors break the engine
      }
    }
  }
}

// ── Utility ─────────────────────────────────────────────────────

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// Re-export key functions
export { recoverState } from './checkpoint.js';
export { resolveToolParams } from './parameter-resolver.js';
export { evaluatePredicate } from './predicate-evaluator.js';
