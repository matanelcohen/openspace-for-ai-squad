import type { EscalationPriority } from '@matanelcohen/openspace-shared';
import { AlertTriangle, ArrowDown, ArrowUp, Flame } from 'lucide-react';
import { memo } from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const priorityConfig: Record<
  EscalationPriority,
  { label: string; icon: typeof Flame; className: string }
> = {
  critical: {
    label: 'Critical',
    icon: Flame,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200',
  },
  high: {
    label: 'High',
    icon: ArrowUp,
    className:
      'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200',
  },
  medium: {
    label: 'Medium',
    icon: AlertTriangle,
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200',
  },
  low: {
    label: 'Low',
    icon: ArrowDown,
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200',
  },
};

interface PriorityIndicatorProps {
  priority: EscalationPriority;
  className?: string;
}

export const PriorityIndicator = memo(function PriorityIndicator({
  priority,
  className,
}: PriorityIndicatorProps) {
  const config = priorityConfig[priority];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(config.className, className)}
      data-testid="priority-indicator"
    >
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
});
