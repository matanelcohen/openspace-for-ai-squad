'use client';

import type { WorkflowNodeType } from '@openspace/shared';
import { Handle, Position } from '@xyflow/react';
import {
  CheckCircle2,
  Circle,
  CircleDot,
  GitBranch,
  Hand,
  Layers,
  Play,
  Split,
  Square,
} from 'lucide-react';
import { memo, useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

import { NodeStatusBadge } from './workflow-status-badge';
import type { WorkflowNodeData } from './workflow-utils';
import { formatDuration } from './workflow-utils';

// ── Node Type Icons ──────────────────────────────────────────────

const nodeTypeIcons: Record<WorkflowNodeType, React.ComponentType<{ className?: string }>> = {
  start: Play,
  end: Square,
  task: CircleDot,
  hitl_gate: Hand,
  condition: GitBranch,
  parallel_split: Split,
  parallel_join: CheckCircle2,
  sub_workflow: Layers,
};

const nodeTypeLabels: Record<WorkflowNodeType, string> = {
  start: 'Start',
  end: 'End',
  task: 'Task',
  hitl_gate: 'HITL Gate',
  condition: 'Condition',
  parallel_split: 'Split',
  parallel_join: 'Join',
  sub_workflow: 'Sub-workflow',
};

// ── Status-based border colors ───────────────────────────────────

function getNodeBorderClass(status?: string): string {
  switch (status) {
    case 'running':
      return 'border-blue-500 shadow-blue-500/20 shadow-md';
    case 'completed':
      return 'border-green-500/50';
    case 'failed':
      return 'border-red-500/50';
    case 'paused':
      return 'border-yellow-500/50';
    case 'skipped':
      return 'border-gray-300 opacity-60';
    default:
      return 'border-border';
  }
}

// ── Component ────────────────────────────────────────────────────

interface WorkflowNodeProps {
  data: WorkflowNodeData;
  selected?: boolean;
}

function WorkflowNodeComponent({ data, selected }: WorkflowNodeProps) {
  const { label, nodeType, executionState } = data;
  const Icon = nodeTypeIcons[nodeType] ?? Circle;
  const status = executionState?.status;

  // Live-ticking duration for running nodes
  const [liveDuration, setLiveDuration] = useState<string | null>(null);

  useEffect(() => {
    if (status !== 'running' || !executionState?.startedAt) {
      setLiveDuration(null);
      return;
    }

    const tick = () => setLiveDuration(formatDuration(executionState.startedAt, null));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status, executionState?.startedAt]);

  const duration =
    liveDuration ??
    (executionState ? formatDuration(executionState.startedAt, executionState.completedAt) : null);

  return (
    <div
      className={cn(
        'rounded-lg border-2 bg-card px-4 py-3 text-card-foreground transition-all',
        'min-w-[200px] max-w-[260px]',
        getNodeBorderClass(status),
        selected && 'ring-2 ring-primary ring-offset-2',
      )}
      data-testid={`workflow-node-${data.nodeType}`}
    >
      {/* Input handle */}
      {nodeType !== 'start' && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
        />
      )}

      {/* Header row */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
            'bg-muted text-muted-foreground',
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{label}</p>
          <p className="text-[10px] text-muted-foreground">{nodeTypeLabels[nodeType]}</p>
        </div>
      </div>

      {/* Status + duration row */}
      {status && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <NodeStatusBadge status={status} className="text-[10px]" />
          {duration && duration !== '—' && (
            <span className="text-[10px] tabular-nums text-muted-foreground">{duration}</span>
          )}
        </div>
      )}

      {/* Error message */}
      {executionState?.error && (
        <p className="mt-1.5 truncate text-[10px] text-red-500" title={executionState.error}>
          {executionState.error}
        </p>
      )}

      {/* Output handle */}
      {nodeType !== 'end' && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-background !bg-muted-foreground"
        />
      )}
    </div>
  );
}

export const WorkflowNode = memo(WorkflowNodeComponent);
