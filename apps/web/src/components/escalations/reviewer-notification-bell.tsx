'use client';

import { AlertTriangle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { memo } from 'react';

import { EscalationStatusBadge } from '@/components/escalations/escalation-status-badge';
import { PriorityIndicator } from '@/components/escalations/priority-indicator';
import { SlaCountdown } from '@/components/escalations/sla-countdown';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useEscalations, usePendingEscalationCount } from '@/hooks/use-escalations';

const MAX_DISPLAYED = 8;

export const ReviewerNotificationBell = memo(function ReviewerNotificationBell() {
  const pendingCount = usePendingEscalationCount();
  const { data: escalations } = useEscalations();
  const router = useRouter();

  const pending = (escalations ?? [])
    .filter((e) => e.status === 'pending' || e.status === 'claimed')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, MAX_DISPLAYED);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Escalation notifications"
          className="relative"
          data-testid="reviewer-notification-bell"
        >
          <AlertTriangle className="h-4 w-4" />
          {pendingCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
              data-testid="escalation-pending-count"
            >
              {pendingCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-96">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Pending Escalations</DropdownMenuLabel>
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={() => router.push('/escalations')}
            data-testid="view-all-escalations"
          >
            View all
          </Button>
        </div>
        <DropdownMenuSeparator />
        {pending.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No pending escalations
          </div>
        ) : (
          pending.map((esc) => (
            <DropdownMenuItem
              key={esc.id}
              className="flex cursor-pointer flex-col items-start gap-1.5 px-3 py-2.5"
              onClick={() => router.push(`/escalations/${esc.id}`)}
              data-testid={`escalation-notification-${esc.id}`}
            >
              <div className="flex w-full items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{esc.context.agentId}</span>
                <PriorityIndicator priority={esc.priority} />
              </div>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {esc.reason.replace(/_/g, ' ')} — {esc.context.proposedAction.slice(0, 80)}
                {esc.context.proposedAction.length > 80 ? '…' : ''}
              </p>
              <div className="flex w-full items-center justify-between gap-2">
                <EscalationStatusBadge status={esc.status} />
                <SlaCountdown timeoutAt={esc.timeoutAt} />
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
