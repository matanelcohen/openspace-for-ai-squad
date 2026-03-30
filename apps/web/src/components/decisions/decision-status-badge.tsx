import type { DecisionStatus } from '@matanelcohen/openspace-shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DecisionStatusBadgeProps {
  status: DecisionStatus;
  className?: string;
}

const statusConfig = {
  active: {
    label: 'Active',
    className: 'bg-green-500 hover:bg-green-600',
  },
  superseded: {
    label: 'Superseded',
    className: 'bg-yellow-500 hover:bg-yellow-600',
  },
  reversed: {
    label: 'Reversed',
    className: 'bg-red-500 hover:bg-red-600',
  },
} as const;

export function DecisionStatusBadge({ status, className }: DecisionStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge
      className={cn(config.className, className)}
      data-testid="decision-status-badge"
      data-status={status}
    >
      {config.label}
    </Badge>
  );
}
