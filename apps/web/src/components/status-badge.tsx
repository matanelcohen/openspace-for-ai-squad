import type { AgentStatus } from '@openspace/shared';
import { AGENT_STATUS_LABELS } from '@openspace/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusStyles: Record<AgentStatus, string> = {
  active: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20',
  idle: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20',
  spawned: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  failed: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
};

interface StatusBadgeProps {
  status: AgentStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant="outline" className={cn(statusStyles[status], className)}>
      <span
        className={cn('mr-1.5 inline-block h-1.5 w-1.5 rounded-full', {
          'bg-green-500': status === 'active',
          'bg-gray-400': status === 'idle',
          'bg-blue-500': status === 'spawned',
          'bg-red-500': status === 'failed',
        })}
      />
      {AGENT_STATUS_LABELS[status]}
    </Badge>
  );
}
