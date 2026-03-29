/**
 * Migration helpers — convert legacy WorkflowDefinition / DAGNode / DAGEdge
 * types to the new DAGWorkflow / StepNode / Edge types.
 *
 * Enables zero-effort upgrades for existing workflows.
 */

import type {
  DAGWorkflow,
  Edge,
  StepNode,
  StepNodeType,
} from '../types/dag-workflow.js';
import type {
  DAGEdge,
  DAGNode,
  WorkflowDefinition,
} from '../types/workflow.js';

/**
 * Convert a legacy WorkflowDefinition to the enhanced DAGWorkflow format.
 * All new fields receive sensible defaults.
 */
export function migrateLegacyWorkflow(def: WorkflowDefinition): DAGWorkflow {
  return {
    id: def.id,
    name: def.name,
    version: '1.0.0',
    nodes: def.nodes.map(migrateLegacyNode),
    edges: def.edges.map(migrateLegacyEdge),
  };
}

/**
 * Convert a legacy DAGNode to a StepNode.
 */
export function migrateLegacyNode(node: DAGNode): StepNode {
  return {
    id: node.id,
    label: node.label,
    type: node.type as StepNodeType,
    config: node.config ?? {},
    retries: 0,
    onFailure: 'fail_workflow',
  };
}

/**
 * Convert a legacy DAGEdge to an Edge with a structured predicate.
 *
 * Legacy edges have `condition?: string` which was a branch label
 * matched against a condition node's output. We wrap this in a
 * ComparisonPredicate that checks `output.branch === conditionString`.
 */
export function migrateLegacyEdge(edge: DAGEdge): Edge {
  const newEdge: Edge = {
    from: edge.from,
    to: edge.to,
  };

  if (edge.condition) {
    newEdge.condition = {
      type: 'comparison',
      field: 'output.branch',
      operator: 'eq',
      value: edge.condition,
    };
    newEdge.label = edge.condition;
  }

  return newEdge;
}
