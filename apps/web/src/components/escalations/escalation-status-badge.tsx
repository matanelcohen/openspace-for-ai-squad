import type { EscalationStatus } from '@matanelcohen/openspace-shared';
import type { Circle} from 'lucide-react';
import { CheckCircle, Clock, Eye, RotateCcw, XCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusConfig: Record<
  EscalationStatus,
  { label: string; icon: typeof Circle; className: string }
> = {
  pending: {
    label: 'Pending',
    icon: Clock,
    className:
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200',
  },
  claimed: {
    label: 'In Review',
    icon: Eye,
    className:
      'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200',
  },
  approved: {
    label: 'Approved',
    icon: CheckCircle,
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200',
  },
  rejected: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200',
  },
  timed_out: {
    label: 'Timed Out',
    icon: RotateCcw,
    className:
      'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200',
  },
  auto_escalated: {
    label: 'Auto-Escalated',
    icon: RotateCcw,
    className:
      'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200',
  },
};

interface EscalationStatusBadgeProps {
  status: EscalationStatus;
  className?: string;
}

export function EscalationStatusBadge({ status, className }: EscalationStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant="outline" className={cn(config.className, className)} data-testid="escalation-status-badge">
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  );
}
