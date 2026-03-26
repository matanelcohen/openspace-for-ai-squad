/**
 * DAGExecutor — Simplified facade for executing DAG workflows.
 *
 * Wraps DAGWorkflowEngine with a cleaner interface:
 * - Accepts a DAGWorkflow (or builds one from a DAGBuilder)
 * - Resolves steps through the Tool Registry
 * - Provides run/resume/cancel/getState convenience methods
 * - Emits events for observability
 *
 * This is the primary entry point for workflow execution.
 */

import type {
  CheckpointStore,
  DAGWorkflow,
  DAGWorkflowEngineConfig,
  EnhancedWorkflowExecutionState,
  EscalationResolution,
  NodeHandler,
  StepNode,
  ExecutionContext,
  ToolRegistryRef,
  WorkflowEventHandler,
  WorkflowStartOptions,
} from '../types/dag-workflow.js';
import { DAGWorkflowEngine, topologicalLevels, validateDAGWorkflow } from './dag-engine.js';
import { DAGBuilder } from './dag-builder.js';

// ── Executor Config ─────────────────────────────────────────────

export interface DAGExecutorConfig {
  /** Persistence layer for execution checkpoints. */
  checkpointStore: CheckpointStore;

  /** Tool Registry for resolving and invoking tools. */
  toolRegistry: ToolRegistryRef;

  /** Named custom handlers for non-tool task nodes. */
  handlers?: Record<string, NodeHandler>;

  /** HITL gate handler. Returns escalation ID. */
  onHITLGate?: (node: StepNode, executionId: string, ctx: ExecutionContext) => Promise<string>;

  /** Escalation resolution provider. */
  resolveEscalation?: (escalationId: string) => Promise<{ approved: boolean; output?: unknown }>;

  /** Maximum concurrent node executions. Default: 10. */
  maxConcurrency?: number;

  /** Event listeners for observability. */
  eventListeners?: WorkflowEventHandler[];
}

// ── Executor ────────────────────────────────────────────────────

export class DAGExecutor {
  private engine: DAGWorkflowEngine;
  private config: DAGExecutorConfig;

  constructor(config: DAGExecutorConfig) {
    this.config = config;

    const engineConfig: DAGWorkflowEngineConfig = {
      checkpointStore: config.checkpointStore,
      toolRegistry: config.toolRegistry,
      handlers: config.handlers,
      onHITLGate: config.onHITLGate ?? defaultHITLGate,
      resolveEscalation: config.resolveEscalation ?? defaultResolveEscalation,
      maxConcurrency: config.maxConcurrency,
      eventListeners: config.eventListeners,
    };

    this.engine = new DAGWorkflowEngine(engineConfig);
  }

  /**
   * Validate a workflow definition.
   * Returns error strings (empty = valid).
   */
  validate(workflow: DAGWorkflow): string[] {
    return validateDAGWorkflow(workflow);
  }

  /**
   * Get the topological execution levels for a workflow.
   * Nodes within the same level can execute in parallel.
   */
  getExecutionLevels(workflow: DAGWorkflow): string[][] {
    return topologicalLevels(workflow.nodes, workflow.edges);
  }

  /**
   * Discover tools available for step resolution.
   */
  discoverTools(filter?: { category?: string; name?: string }): Array<{
    id: string;
    name: string;
    description: string;
    category: string;
  }> {
    return this.config.toolRegistry.discover(filter);
  }

  /**
   * Run a workflow from a DAGWorkflow definition.
   * Returns the final execution state.
   */
  async run(
    workflow: DAGWorkflow,
    options?: WorkflowStartOptions,
  ): Promise<EnhancedWorkflowExecutionState> {
    return this.engine.start(workflow, options);
  }

  /**
   * Run a workflow directly from a DAGBuilder.
   * Builds and validates the workflow, then executes it.
   */
  async runFromBuilder(
    builder: DAGBuilder,
    options?: WorkflowStartOptions,
  ): Promise<EnhancedWorkflowExecutionState> {
    const workflow = builder.build();
    return this.engine.start(workflow, options);
  }

  /**
   * Resume a paused workflow after HITL approval/rejection.
   */
  async resume(
    workflow: DAGWorkflow,
    executionId: string,
    resolution: EscalationResolution,
  ): Promise<EnhancedWorkflowExecutionState> {
    return this.engine.resume(workflow, executionId, resolution);
  }

  /**
   * Cancel a running or paused workflow.
   */
  async cancel(executionId: string): Promise<EnhancedWorkflowExecutionState> {
    return this.engine.cancel(executionId);
  }

  /**
   * Get the current execution state from checkpoint store.
   */
  async getState(executionId: string): Promise<EnhancedWorkflowExecutionState | null> {
    return this.engine.getState(executionId);
  }

  /**
   * Subscribe to workflow events.
   */
  on(handler: WorkflowEventHandler): void {
    this.engine.on('workflow:started', handler);
  }
}

// ── Default Handlers ────────────────────────────────────────────

async function defaultHITLGate(
  _node: StepNode,
  _executionId: string,
  _ctx: ExecutionContext,
): Promise<string> {
  throw new Error(
    'HITL gate reached but no onHITLGate handler configured. ' +
    'Provide onHITLGate in DAGExecutorConfig to handle human-in-the-loop gates.',
  );
}

async function defaultResolveEscalation(
  _escalationId: string,
): Promise<{ approved: boolean; output?: unknown }> {
  throw new Error(
    'Escalation resolution requested but no resolveEscalation handler configured. ' +
    'Provide resolveEscalation in DAGExecutorConfig to handle escalation resolutions.',
  );
}
