'use client';

import '@xyflow/react/dist/style.css';

import type { WorkflowDefinition, WorkflowExecutionState } from '@openspace/shared';
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import { useEffect, useMemo } from 'react';

import { cn } from '@/lib/utils';

import { WorkflowEdge } from './workflow-edge';
import { WorkflowNode } from './workflow-node';
import { WorkflowStatusBadge } from './workflow-status-badge';
import { toFlowEdges, toFlowNodes } from './workflow-utils';

// ── Custom Node / Edge Types ─────────────────────────────────────

const nodeTypes = { workflowNode: WorkflowNode };
const edgeTypes = { workflowEdge: WorkflowEdge };

// ── Props ────────────────────────────────────────────────────────

export interface WorkflowViewerProps {
  definition: WorkflowDefinition;
  executionState?: WorkflowExecutionState;
  className?: string;
}

/**
 * Renders a workflow DAG as an interactive graph.
 * Shows node statuses and durations when executionState is provided.
 * Supports zoom, pan, and minimap.
 */
function ViewerInner({ definition, executionState, className }: WorkflowViewerProps) {
  const initialNodes = useMemo(
    () => toFlowNodes(definition, executionState),
    [definition, executionState],
  );
  const initialEdges = useMemo(() => toFlowEdges(definition), [definition]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync when definition or execution state changes (real-time updates)
  useEffect(() => {
    setNodes(toFlowNodes(definition, executionState));
  }, [definition, executionState, setNodes]);

  useEffect(() => {
    setEdges(toFlowEdges(definition));
  }, [definition, setEdges]);

  // Animate edges connected to running nodes
  const animatedEdges = useMemo(() => {
    if (!executionState) return edges;
    const runningNodeIds = new Set(
      Object.entries(executionState.nodeStates)
        .filter(([, ns]) => ns.status === 'running')
        .map(([id]) => id),
    );
    return edges.map((edge) => ({
      ...edge,
      animated: runningNodeIds.has(edge.source) || runningNodeIds.has(edge.target),
    }));
  }, [edges, executionState]);

  return (
    <div
      className={cn('relative h-[600px] w-full overflow-hidden rounded-lg border', className)}
      data-testid="workflow-viewer"
    >
      {/* Overall workflow status header */}
      {executionState && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-md border bg-background/80 px-3 py-1.5 backdrop-blur-sm">
          <span className="text-xs font-medium text-muted-foreground">Workflow:</span>
          <WorkflowStatusBadge status={executionState.status} />
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={animatedEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{
          type: 'workflowEdge',
          markerEnd: { type: 'arrowclosed' as never, width: 16, height: 16 },
        }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} className="!border-border !bg-background !shadow-md" />
        <MiniMap
          nodeColor={(node) => {
            const status = (node.data as Record<string, unknown>)?.executionState as
              | { status?: string }
              | undefined;
            switch (status?.status) {
              case 'running':
                return '#3b82f6';
              case 'completed':
                return '#22c55e';
              case 'failed':
                return '#ef4444';
              case 'paused':
                return '#eab308';
              default:
                return '#94a3b8';
            }
          }}
          className="!border-border !bg-background/80"
          maskColor="rgba(0,0,0,0.1)"
        />
      </ReactFlow>
    </div>
  );
}

// ── Public Wrapper (provides ReactFlowProvider) ──────────────────

export function WorkflowViewer(props: WorkflowViewerProps) {
  return (
    <ReactFlowProvider>
      <ViewerInner {...props} />
    </ReactFlowProvider>
  );
}
