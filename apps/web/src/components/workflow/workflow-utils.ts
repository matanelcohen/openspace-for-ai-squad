/**
 * Utilities for converting between @openspace/shared workflow types
 * and @xyflow/react node/edge types, plus layout computation.
 */

import type {
  DAGEdge,
  DAGNode,
  NodeExecutionState,
  WorkflowDefinition,
  WorkflowExecutionState,
  WorkflowNodeType,
} from '@openspace/shared';
import type { Edge, Node } from '@xyflow/react';

// ── React Flow Node Data ─────────────────────────────────────────

export interface WorkflowNodeData extends Record<string, unknown> {
  label: string;
  nodeType: WorkflowNodeType;
  config: Record<string, unknown>;
  executionState?: NodeExecutionState;
}

// ── Layout Constants ─────────────────────────────────────────────

const NODE_WIDTH = 220;
const NODE_HEIGHT = 80;
const HORIZONTAL_GAP = 60;
const VERTICAL_GAP = 40;

// ── Conversion Functions ─────────────────────────────────────────

/**
 * Convert a WorkflowDefinition + optional execution state into React Flow nodes.
 */
export function toFlowNodes(
  definition: WorkflowDefinition,
  executionState?: WorkflowExecutionState,
): Node<WorkflowNodeData>[] {
  const positions = computeLayout(definition.nodes, definition.edges);

  return definition.nodes.map((node) => ({
    id: node.id,
    type: 'workflowNode',
    position: positions.get(node.id) ?? { x: 0, y: 0 },
    data: {
      label: node.label,
      nodeType: node.type,
      config: node.config,
      executionState: executionState?.nodeStates[node.id],
    },
    draggable: true,
  }));
}

/**
 * Convert a WorkflowDefinition's edges into React Flow edges.
 */
export function toFlowEdges(definition: WorkflowDefinition): Edge[] {
  return definition.edges.map((edge, index) => ({
    id: `e-${edge.from}-${edge.to}-${index}`,
    source: edge.from,
    target: edge.to,
    type: 'workflowEdge',
    label: edge.condition ?? undefined,
    animated: false,
    data: { condition: edge.condition },
  }));
}

/**
 * Convert React Flow nodes/edges back to a WorkflowDefinition.
 */
export function fromFlowState(
  id: string,
  name: string,
  nodes: Node<WorkflowNodeData>[],
  edges: Edge[],
): WorkflowDefinition {
  const dagNodes: DAGNode[] = nodes.map((n) => ({
    id: n.id,
    label: (n.data as WorkflowNodeData).label,
    type: (n.data as WorkflowNodeData).nodeType,
    config: (n.data as WorkflowNodeData).config,
  }));

  const dagEdges: DAGEdge[] = edges.map((e) => ({
    from: e.source,
    to: e.target,
    condition: (e.data as { condition?: string })?.condition,
  }));

  return { id, name, nodes: dagNodes, edges: dagEdges };
}

// ── Layout Algorithm ─────────────────────────────────────────────

/**
 * Simple layered layout: assign nodes to layers via longest-path,
 * then position each layer left-to-right.
 */
export function computeLayout(
  nodes: DAGNode[],
  edges: DAGEdge[],
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  if (nodes.length === 0) return positions;

  // Build adjacency and reverse adjacency
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  for (const node of nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }
  for (const edge of edges) {
    adjacency.get(edge.from)?.push(edge.to);
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  // Assign layers using topological ordering (Kahn's algorithm)
  const layers = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
      layers.set(id, 0);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current) ?? 0;
    for (const neighbor of adjacency.get(current) ?? []) {
      const existingLayer = layers.get(neighbor) ?? 0;
      layers.set(neighbor, Math.max(existingLayer, currentLayer + 1));
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  // Handle unconnected nodes
  for (const node of nodes) {
    if (!layers.has(node.id)) {
      layers.set(node.id, 0);
    }
  }

  // Group nodes by layer
  const layerGroups = new Map<number, string[]>();
  for (const [id, layer] of layers) {
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(id);
  }

  // Position nodes
  for (const [layer, nodeIds] of layerGroups) {
    const x = layer * (NODE_WIDTH + HORIZONTAL_GAP);
    const totalHeight = nodeIds.length * NODE_HEIGHT + (nodeIds.length - 1) * VERTICAL_GAP;
    const startY = -totalHeight / 2;

    nodeIds.forEach((id, index) => {
      positions.set(id, {
        x,
        y: startY + index * (NODE_HEIGHT + VERTICAL_GAP),
      });
    });
  }

  return positions;
}

/**
 * Compute human-readable duration between two ISO timestamps.
 */
export function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '—';
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - start;

  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}
