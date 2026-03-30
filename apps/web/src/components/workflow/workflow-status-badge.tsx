'use client';

import type { NodeExecutionStatus, WorkflowExecutionStatus } from '@matanelcohen/openspace-shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const nodeStatusConfig: Record<
  NodeExecutionStatus,
  { label: string; dot: string; badge: string }
> = {
  pending: {
    label: 'Pending',
    dot: 'bg-gray-400',
    badge: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20',
  },
  running: {
    label: 'Running',
    dot: 'bg-blue-500 animate-pulse',
    badge: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
  completed: {
    label: 'Completed',
    dot: 'bg-green-500',
    badge: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20',
  },
  failed: {
    label: 'Failed',
    dot: 'bg-red-500',
    badge: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  },
  paused: {
    label: 'Paused',
    dot: 'bg-yellow-500',
    badge: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  },
  skipped: {
    label: 'Skipped',
    dot: 'bg-gray-300',
    badge: 'bg-gray-300/15 text-gray-500 dark:text-gray-500 border-gray-300/20',
  },
};

const workflowStatusConfig: Record<
  WorkflowExecutionStatus,
  { label: string; dot: string; badge: string }
> = {
  pending: nodeStatusConfig.pending,
  running: nodeStatusConfig.running,
  completed: nodeStatusConfig.completed,
  failed: nodeStatusConfig.failed,
  paused: nodeStatusConfig.paused,
  cancelled: {
    label: 'Cancelled',
    dot: 'bg-gray-400',
    badge: 'bg-gray-400/15 text-gray-600 dark:text-gray-400 border-gray-400/20',
  },
};

interface NodeStatusBadgeProps {
  status: NodeExecutionStatus;
  className?: string;
}

export function NodeStatusBadge({ status, className }: NodeStatusBadgeProps) {
  const config = nodeStatusConfig[status];
  return (
    <Badge variant="outline" className={cn(config.badge, className)} data-testid="node-status">
      <span className={cn('mr-1.5 inline-block h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </Badge>
  );
}

interface WorkflowStatusBadgeProps {
  status: WorkflowExecutionStatus;
  className?: string;
}

export function WorkflowStatusBadge({ status, className }: WorkflowStatusBadgeProps) {
  const config = workflowStatusConfig[status];
  return (
    <Badge variant="outline" className={cn(config.badge, className)} data-testid="workflow-status">
      <span className={cn('mr-1.5 inline-block h-1.5 w-1.5 rounded-full', config.dot)} />
      {config.label}
    </Badge>
  );
}
