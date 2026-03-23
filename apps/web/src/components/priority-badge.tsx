import type { TaskPriority } from '@openspace/shared';
import { TASK_PRIORITY_LABELS } from '@openspace/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const priorityStyles: Record<TaskPriority, string> = {
  P0: 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20',
  P1: 'bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20',
  P2: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  P3: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20',
};

interface PriorityBadgeProps {
  priority: TaskPriority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge variant="outline" className={cn(priorityStyles[priority], className)}>
      {priority} — {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}
