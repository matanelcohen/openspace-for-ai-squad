'use client';

import '@xyflow/react/dist/style.css';

import type { Task, TaskStatus } from '@matanelcohen/openspace-shared';
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  Handle,
  type Node,
  type NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { AlertTriangle, CheckCircle2, Circle, Loader2, Lock } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Status Colors & Icons ────────────────────────────────────────

const STATUS_CONFIG: Record<TaskStatus, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  done: {
    bg: 'bg-green-50 dark:bg-green-950/40',
    border: 'border-green-400 dark:border-green-600',
    text: 'text-green-700 dark:text-green-300',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,
  },
  'in-progress': {
    bg: 'bg-yellow-50 dark:bg-yellow-950/40',
    border: 'border-yellow-400 dark:border-yellow-600',
    text: 'text-yellow-700 dark:text-yellow-300',
    icon: <Loader2 className="h-3.5 w-3.5 text-yellow-600 animate-spin" />,
  },
  blocked: {
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-400 dark:border-red-600',
    text: 'text-red-700 dark:text-red-300',
    icon: <Lock className="h-3.5 w-3.5 text-red-600" />,
  },
  pending: {
    bg: 'bg-gray-50 dark:bg-gray-900/40',
    border: 'border-gray-300 dark:border-gray-600',
    text: 'text-gray-600 dark:text-gray-400',
    icon: <Circle className="h-3.5 w-3.5 text-gray-400" />,
  },
  delegated: {
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    border: 'border-blue-400 dark:border-blue-600',
    text: 'text-blue-700 dark:text-blue-300',
    icon: <Circle className="h-3.5 w-3.5 text-blue-500" />,
  },
};

// ── Node Data Type ───────────────────────────────────────────────

interface TaskNodeData extends Record<string, unknown> {
  task: Task;
  isCurrent: boolean;
  hasIncompleteDeps: boolean;
}

// ── Custom Task Node ─────────────────────────────────────────────

function TaskNode({ data }: NodeProps<Node<TaskNodeData>>) {
  const { task, isCurrent, hasIncompleteDeps } = data;
  const config = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending;

  return (
    <div
      className={cn(
        'rounded-lg border-2 px-3 py-2 shadow-sm transition-all min-w-[180px] max-w-[220px]',
        config.bg,
        config.border,
        isCurrent && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        hasIncompleteDeps && task.status !== 'done' && 'border-dashed',
      )}
      data-testid={`dep-node-${task.id}`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground !w-2 !h-2" />
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground !w-2 !h-2" />

      <div className="flex items-start gap-2">
        <div className="mt-0.5 shrink-0">{config.icon}</div>
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks/${task.id}`}
            className="text-xs font-semibold leading-tight hover:underline block truncate"
            title={task.title}
          >
            {task.title}
          </Link>
          <div className="mt-1 flex items-center gap-1.5">
            <Badge
              variant="secondary"
              className={cn('text-[10px] px-1.5 py-0', config.text)}
            >
              {task.status}
            </Badge>
            {hasIncompleteDeps && task.status !== 'done' && (
              <span title="Has incomplete dependencies">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Layout Algorithm ─────────────────────────────────────────────

const NODE_WIDTH = 220;
const NODE_HEIGHT = 70;
const H_GAP = 80;
const V_GAP = 30;

function computeDAGLayout(
  tasks: Task[],
  currentTaskId: string,
): { nodes: Node<TaskNodeData>[]; edges: Edge[] } {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  // Build edges: dependency → task (dependency must complete before task can start)
  const edges: Edge[] = [];
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const task of tasks) {
    adjacency.set(task.id, []);
    inDegree.set(task.id, 0);
  }

  for (const task of tasks) {
    for (const depId of task.dependencies ?? []) {
      if (taskMap.has(depId)) {
        adjacency.get(depId)?.push(task.id);
        inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
        edges.push({
          id: `e-${depId}-${task.id}`,
          source: depId,
          target: task.id,
          type: 'default',
          animated: task.status === 'in-progress' || taskMap.get(depId)?.status === 'in-progress',
          style: { stroke: taskMap.get(depId)?.status === 'done' ? '#22c55e' : '#94a3b8', strokeWidth: 2 },
          markerEnd: { type: 'arrowclosed' as never, width: 14, height: 14 },
        });
      }
    }
  }

  // Topological layered layout (Kahn's algorithm)
  const layers = new Map<string, number>();
  const queue: string[] = [];

  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
      layers.set(id, 0);
    }
  }

  const tempInDegree = new Map(inDegree);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentLayer = layers.get(current) ?? 0;
    for (const neighbor of adjacency.get(current) ?? []) {
      const existingLayer = layers.get(neighbor) ?? 0;
      layers.set(neighbor, Math.max(existingLayer, currentLayer + 1));
      const newDeg = (tempInDegree.get(neighbor) ?? 1) - 1;
      tempInDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // Handle cycles / unconnected nodes
  for (const task of tasks) {
    if (!layers.has(task.id)) layers.set(task.id, 0);
  }

  // Group by layer
  const layerGroups = new Map<number, string[]>();
  for (const [id, layer] of layers) {
    if (!layerGroups.has(layer)) layerGroups.set(layer, []);
    layerGroups.get(layer)!.push(id);
  }

  // Determine which tasks have incomplete dependencies
  const incompleteDepsSet = new Set<string>();
  for (const task of tasks) {
    for (const depId of task.dependencies ?? []) {
      const dep = taskMap.get(depId);
      if (dep && dep.status !== 'done') {
        incompleteDepsSet.add(task.id);
        break;
      }
    }
  }

  // Build positioned nodes
  const nodes: Node<TaskNodeData>[] = [];
  for (const [layer, nodeIds] of layerGroups) {
    const x = layer * (NODE_WIDTH + H_GAP);
    const totalHeight = nodeIds.length * NODE_HEIGHT + (nodeIds.length - 1) * V_GAP;
    const startY = -totalHeight / 2;

    nodeIds.forEach((id, index) => {
      const task = taskMap.get(id);
      if (!task) return;
      nodes.push({
        id,
        type: 'taskNode',
        position: { x, y: startY + index * (NODE_HEIGHT + V_GAP) },
        data: {
          task,
          isCurrent: id === currentTaskId,
          hasIncompleteDeps: incompleteDepsSet.has(id),
        },
      });
    });
  }

  return { nodes, edges };
}

// ── Main Component ───────────────────────────────────────────────

const nodeTypes = { taskNode: TaskNode };

interface TaskDependencyGraphProps {
  tasks: Task[];
  currentTaskId: string;
  className?: string;
}

function GraphInner({ tasks, currentTaskId, className }: TaskDependencyGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => computeDAGLayout(tasks, currentTaskId),
    [tasks, currentTaskId],
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div
      className={cn('h-[350px] w-full overflow-hidden rounded-lg border bg-background', className)}
      data-testid="task-dependency-graph"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
        nodesDraggable
        nodesConnectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} className="!border-border !bg-background !shadow-md" />
      </ReactFlow>
    </div>
  );
}

export function TaskDependencyGraph(props: TaskDependencyGraphProps) {
  return (
    <ReactFlowProvider>
      <GraphInner {...props} />
    </ReactFlowProvider>
  );
}
