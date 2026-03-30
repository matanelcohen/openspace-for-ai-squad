'use client';

import '@xyflow/react/dist/style.css';

import type { WorkflowDefinition, WorkflowNodeType } from '@matanelcohen/openspace-shared';
import {
  addEdge,
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  type Edge,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { useCallback, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { ComposerNodePalette } from './composer-node-palette';
import { ComposerToolbar } from './composer-toolbar';
import { WorkflowEdge } from './workflow-edge';
import { WorkflowNode } from './workflow-node';
import type { WorkflowNodeData } from './workflow-utils';
import { fromFlowState } from './workflow-utils';

// ── Custom Node / Edge Types ─────────────────────────────────────

const nodeTypes = { workflowNode: WorkflowNode };
const edgeTypes = { workflowEdge: WorkflowEdge };

// ── Props ────────────────────────────────────────────────────────

interface WorkflowComposerProps {
  initialDefinition?: WorkflowDefinition;
  onSave?: (definition: WorkflowDefinition) => void;
  className?: string;
}

// ── Inner Composer (needs ReactFlowProvider context) ─────────────

function ComposerInner({ initialDefinition, onSave, className }: WorkflowComposerProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const nodeIdCounter = useRef(0);

  const [workflowName, setWorkflowName] = useState(initialDefinition?.name ?? 'New Workflow');
  const [workflowId] = useState(initialDefinition?.id ?? `wf-${Date.now()}`);

  // Initialize nodes/edges from definition if provided
  const getInitialNodes = (): Node<WorkflowNodeData>[] => {
    if (!initialDefinition) return [];
    return initialDefinition.nodes.map((n, i) => ({
      id: n.id,
      type: 'workflowNode',
      position: { x: i * 280, y: 100 },
      data: {
        label: n.label,
        nodeType: n.type,
        config: n.config,
      },
    }));
  };

  const getInitialEdges = (): Edge[] => {
    if (!initialDefinition) return [];
    return initialDefinition.edges.map((e, i) => ({
      id: `e-${e.from}-${e.to}-${i}`,
      source: e.from,
      target: e.to,
      type: 'workflowEdge',
      label: e.condition ?? undefined,
      data: { condition: e.condition },
    }));
  };

  const [nodes, setNodes, onNodesChange] = useNodesState(getInitialNodes());
  const [edges, setEdges, onEdgesChange] = useEdgesState(getInitialEdges());

  // ── Handle new connections ───────────────────────────────────

  const onConnect = useCallback(
    (connection: Connection) => {
      const newEdge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        type: 'workflowEdge',
      };
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges],
  );

  // ── Handle drop from palette ─────────────────────────────────

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const nodeType = event.dataTransfer.getData('application/reactflow-type') as WorkflowNodeType;
      const label = event.dataTransfer.getData('application/reactflow-label');

      if (!nodeType) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newId = `node-${++nodeIdCounter.current}-${Date.now()}`;

      const newNode: Node<WorkflowNodeData> = {
        id: newId,
        type: 'workflowNode',
        position,
        data: {
          label: label || nodeType,
          nodeType,
          config: {},
        },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [screenToFlowPosition, setNodes],
  );

  // ── Toolbar actions ──────────────────────────────────────────

  const getDefinition = useCallback((): WorkflowDefinition => {
    return fromFlowState(workflowId, workflowName, nodes, edges);
  }, [workflowId, workflowName, nodes, edges]);

  const handleSave = useCallback(() => {
    const def = getDefinition();
    onSave?.(def);
  }, [getDefinition, onSave]);

  const handleClear = useCallback(() => {
    setNodes([]);
    setEdges([]);
  }, [setNodes, setEdges]);

  const handleExport = useCallback(() => {
    const def = getDefinition();
    const json = JSON.stringify(def, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [getDefinition, workflowName]);

  // ── Handle node deletion via keyboard ────────────────────────

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Delete' || event.key === 'Backspace') {
        setNodes((nds) => nds.filter((n) => !n.selected));
        setEdges((eds) => eds.filter((e) => !e.selected));
      }
    },
    [setNodes, setEdges],
  );

  return (
    <div className={cn('flex flex-col gap-3', className)} data-testid="workflow-composer">
      <ComposerToolbar
        workflowName={workflowName}
        onNameChange={setWorkflowName}
        onSave={handleSave}
        onClear={handleClear}
        onExport={handleExport}
        getDefinition={getDefinition}
      />

      <div className="flex gap-3">
        {/* Palette sidebar */}
        <div className="w-[220px] shrink-0 rounded-lg border bg-card p-3">
          <ComposerNodePalette />
        </div>

        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className="h-[600px] flex-1 overflow-hidden rounded-lg border"
          onKeyDown={onKeyDown}
          tabIndex={0}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            defaultEdgeOptions={{
              type: 'workflowEdge',
              markerEnd: { type: 'arrowclosed' as never, width: 16, height: 16 },
            }}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={2}
            deleteKeyCode={['Delete', 'Backspace']}
            proOptions={{ hideAttribution: true }}
            className="bg-background"
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls
              showInteractive={false}
              className="!border-border !bg-background !shadow-md"
            />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

// ── Public Wrapper (provides ReactFlowProvider) ──────────────────

import { ReactFlowProvider } from '@xyflow/react';

export function WorkflowComposer(props: WorkflowComposerProps) {
  return (
    <ReactFlowProvider>
      <ComposerInner {...props} />
    </ReactFlowProvider>
  );
}
