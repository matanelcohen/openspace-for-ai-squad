/**
 * DAGBuilder — Fluent API for composing DAGWorkflow definitions
 * from steps (nodes) and edges.
 *
 * Usage:
 * ```ts
 * const workflow = new DAGBuilder('my-workflow', 'My Workflow')
 *   .addStep({ id: 'fetch', label: 'Fetch data', type: 'task', config: { toolId: 'http-get' } })
 *   .addStep({ id: 'transform', label: 'Transform', type: 'task', config: { handler: 'transform' } })
 *   .addEdge('fetch', 'transform')
 *   .build();
 * ```
 *
 * The builder automatically injects `start` and `end` sentinel nodes
 * and wires them to root/leaf nodes if not already present.
 */

import type {
  ConditionalPredicate,
  DAGWorkflow,
  Edge,
  StepNode,
  StepNodeConfig,
  StepNodeType,
} from '../types/dag-workflow.js';
import { hasDAGCycle, validateDAGWorkflow } from './dag-engine.js';

// ── Builder Input Types ─────────────────────────────────────────

export interface StepInput {
  id: string;
  label: string;
  type: StepNodeType;
  config: StepNodeConfig;
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  onFailure?: 'fail_workflow' | 'skip' | 'continue';
  metadata?: Record<string, unknown>;
}

export interface DAGBuilderOptions {
  version?: string;
  description?: string;
  defaultVars?: Record<string, unknown>;
  requiredSecrets?: string[];
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
  /** If true, skip auto-injection of start/end nodes. Default false. */
  manualSentinels?: boolean;
}

// ── Errors ──────────────────────────────────────────────────────

export class DAGBuilderError extends Error {
  constructor(
    message: string,
    public readonly validationErrors?: string[],
  ) {
    super(message);
    this.name = 'DAGBuilderError';
  }
}

// ── Builder ─────────────────────────────────────────────────────

export class DAGBuilder {
  private id: string;
  private name: string;
  private options: DAGBuilderOptions;
  private nodes: Map<string, StepNode> = new Map();
  private edges: Edge[] = [];

  constructor(id: string, name: string, options?: DAGBuilderOptions) {
    this.id = id;
    this.name = name;
    this.options = options ?? {};
  }

  /**
   * Add a step (node) to the workflow.
   * @returns this (for chaining)
   */
  addStep(input: StepInput): this {
    if (this.nodes.has(input.id)) {
      throw new DAGBuilderError(`Duplicate step ID: "${input.id}"`);
    }

    const node: StepNode = {
      id: input.id,
      label: input.label,
      type: input.type,
      config: input.config,
      ...(input.timeoutMs !== undefined && { timeoutMs: input.timeoutMs }),
      ...(input.retries !== undefined && { retries: input.retries }),
      ...(input.retryDelayMs !== undefined && { retryDelayMs: input.retryDelayMs }),
      ...(input.onFailure !== undefined && { onFailure: input.onFailure }),
      ...(input.metadata !== undefined && { metadata: input.metadata }),
    };

    this.nodes.set(input.id, node);
    return this;
  }

  /**
   * Add a directed edge between two steps.
   * @returns this (for chaining)
   */
  addEdge(from: string, to: string, label?: string): this {
    this.edges.push({ from, to, ...(label && { label }) });
    return this;
  }

  /**
   * Add a conditional edge with a predicate.
   * The edge is only traversed when the predicate evaluates to true.
   * @returns this (for chaining)
   */
  addConditionalEdge(
    from: string,
    to: string,
    condition: ConditionalPredicate,
    options?: { label?: string; priority?: number },
  ): this {
    this.edges.push({
      from,
      to,
      condition,
      ...(options?.label && { label: options.label }),
      ...(options?.priority !== undefined && { priority: options.priority }),
    });
    return this;
  }

  /**
   * Validate the current graph without building.
   * Returns an array of error strings (empty = valid).
   */
  validate(): string[] {
    const snapshot = this.buildSnapshot();
    return validateDAGWorkflow(snapshot);
  }

  /**
   * Build the final DAGWorkflow definition.
   * Injects start/end sentinels if needed, then validates.
   * Throws DAGBuilderError if the workflow is invalid.
   */
  build(): DAGWorkflow {
    const snapshot = this.buildSnapshot();
    const errors = validateDAGWorkflow(snapshot);

    if (errors.length > 0) {
      throw new DAGBuilderError(
        `Invalid workflow: ${errors.join('; ')}`,
        errors,
      );
    }

    return snapshot;
  }

  /**
   * Check if adding an edge would create a cycle.
   * Does not mutate the builder state.
   */
  wouldCycle(from: string, to: string): boolean {
    const nodes = [...this.nodes.values()];
    const edges = [...this.edges, { from, to }];
    return hasDAGCycle(nodes, edges);
  }

  /**
   * Remove a step and all edges referencing it.
   * @returns this (for chaining)
   */
  removeStep(id: string): this {
    this.nodes.delete(id);
    this.edges = this.edges.filter((e) => e.from !== id && e.to !== id);
    return this;
  }

  /**
   * Remove an edge by from/to pair.
   * @returns this (for chaining)
   */
  removeEdge(from: string, to: string): this {
    this.edges = this.edges.filter((e) => !(e.from === from && e.to === to));
    return this;
  }

  /** Get current step count (excluding auto-generated sentinels). */
  get stepCount(): number {
    return this.nodes.size;
  }

  /** Get current edge count (excluding auto-generated sentinel edges). */
  get edgeCount(): number {
    return this.edges.length;
  }

  // ── Private ────────────────────────────────────────────────────

  /**
   * Build a snapshot of the workflow, injecting start/end sentinels
   * and wiring them to root/leaf nodes as needed.
   */
  private buildSnapshot(): DAGWorkflow {
    const allNodes = [...this.nodes.values()];
    const allEdges = [...this.edges];

    if (!this.options.manualSentinels) {
      // Auto-inject start node if not present
      const hasStart = allNodes.some((n) => n.type === 'start');
      if (!hasStart) {
        const startNode: StepNode = {
          id: '__start__',
          label: 'Start',
          type: 'start',
          config: {},
        };
        allNodes.unshift(startNode);

        // Wire start → all root nodes (nodes with no incoming edges)
        const nodesWithIncoming = new Set(allEdges.map((e) => e.to));
        for (const node of this.nodes.values()) {
          if (!nodesWithIncoming.has(node.id)) {
            allEdges.push({ from: '__start__', to: node.id });
          }
        }
      }

      // Auto-inject end node if not present
      const hasEnd = allNodes.some((n) => n.type === 'end');
      if (!hasEnd) {
        const endNode: StepNode = {
          id: '__end__',
          label: 'End',
          type: 'end',
          config: {},
        };
        allNodes.push(endNode);

        // Wire all leaf nodes → end (nodes with no outgoing edges)
        const nodesWithOutgoing = new Set(allEdges.map((e) => e.from));
        for (const node of this.nodes.values()) {
          if (!nodesWithOutgoing.has(node.id)) {
            allEdges.push({ from: node.id, to: '__end__' });
          }
        }
      }
    }

    return {
      id: this.id,
      name: this.name,
      version: this.options.version ?? '1.0.0',
      ...(this.options.description && { description: this.options.description }),
      nodes: allNodes,
      edges: allEdges,
      ...(this.options.defaultVars && { defaultVars: this.options.defaultVars }),
      ...(this.options.requiredSecrets && { requiredSecrets: this.options.requiredSecrets }),
      ...(this.options.timeoutMs !== undefined && { timeoutMs: this.options.timeoutMs }),
      ...(this.options.metadata && { metadata: this.options.metadata }),
    };
  }
}
