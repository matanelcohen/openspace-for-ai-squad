'use client';

import type { TeamMemberStatus } from '@openspace/shared';
import { TEAM_MEMBER_STATUS_LABELS, TEAM_MEMBER_STATUSES } from '@openspace/shared';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

const statusIndicator: Record<TeamMemberStatus, { dot: string; bg: string; text: string }> = {
  active: {
    dot: 'bg-green-500',
    bg: 'bg-green-500/15 border-green-500/20',
    text: 'text-green-700 dark:text-green-400',
  },
  inactive: {
    dot: 'bg-gray-400',
    bg: 'bg-gray-500/15 border-gray-500/20',
    text: 'text-gray-700 dark:text-gray-400',
  },
  'on-leave': {
    dot: 'bg-amber-500',
    bg: 'bg-amber-500/15 border-amber-500/20',
    text: 'text-amber-700 dark:text-amber-400',
  },
};

interface TeamMemberStatusBadgeProps {
  status: TeamMemberStatus;
  className?: string;
}

export function TeamMemberStatusBadge({ status, className }: TeamMemberStatusBadgeProps) {
  const config = statusIndicator[status];
  return (
    <Badge
      variant="outline"
      className={cn(config.bg, config.text, className)}
      data-testid={`status-badge-${status}`}
    >
      <span className={cn('mr-1.5 inline-block h-2 w-2 rounded-full', config.dot)} />
      {TEAM_MEMBER_STATUS_LABELS[status]}
    </Badge>
  );
}

interface StatusManagementSelectProps {
  currentStatus: TeamMemberStatus;
  onStatusChange: (status: TeamMemberStatus) => void;
  disabled?: boolean;
}

export function StatusManagementSelect({
  currentStatus,
  onStatusChange,
  disabled,
}: StatusManagementSelectProps) {
  return (
    <div className="flex items-center gap-2" data-testid="status-management-select">
      <span className={cn('h-2.5 w-2.5 rounded-full', statusIndicator[currentStatus].dot)} />
      <Select
        value={currentStatus}
        onValueChange={(val) => onStatusChange(val as TeamMemberStatus)}
        disabled={disabled}
      >
        <SelectTrigger className="w-36" data-testid="status-select-trigger">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {TEAM_MEMBER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              <span className="flex items-center gap-2">
                <span className={cn('inline-block h-2 w-2 rounded-full', statusIndicator[s].dot)} />
                {TEAM_MEMBER_STATUS_LABELS[s]}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
