'use client';

import type { AuditEntry } from '@openspace/shared';
import { CheckCircle, Clock, Eye, RotateCcw, XCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

interface AuditTrailTimelineProps {
  entries: AuditEntry[];
}

function getEntryIcon(action: AuditEntry['action']) {
  switch (action) {
    case 'created':
      return <Clock className="h-4 w-4 text-blue-500" />;
    case 'claimed':
      return <Eye className="h-4 w-4 text-blue-500" />;
    case 'approved':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'rejected':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'timed_out':
    case 'auto_escalated':
      return <RotateCcw className="h-4 w-4 text-purple-500" />;
    case 'context_updated':
    case 'level_changed':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatAction(action: AuditEntry['action']): string {
  switch (action) {
    case 'created':
      return 'Escalation created';
    case 'claimed':
      return 'Claimed for review';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Rejected';
    case 'timed_out':
      return 'Timed out';
    case 'auto_escalated':
      return 'Auto-escalated to next level';
    case 'context_updated':
      return 'Context updated';
    case 'level_changed':
      return 'Escalation level changed';
    default:
      return String(action);
  }
}

export function AuditTrailTimeline({ entries }: AuditTrailTimelineProps) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="audit-trail-empty">
        No audit trail entries.
      </p>
    );
  }

  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );

  return (
    <div className="space-y-0" data-testid="audit-trail-timeline">
      {sorted.map((entry, index) => (
        <div key={entry.id} className="flex gap-3" data-testid={`audit-entry-${entry.id}`}>
          {/* Timeline connector */}
          <div className="flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border bg-background">
              {getEntryIcon(entry.action)}
            </div>
            {index < sorted.length - 1 && <div className="w-px flex-1 bg-border" />}
          </div>

          {/* Content */}
          <div className={cn('pb-6', index === sorted.length - 1 && 'pb-0')}>
            <p className="text-sm font-medium">{formatAction(entry.action)}</p>
            <p className="text-xs text-muted-foreground">
              by <span className="font-medium">{entry.actor}</span>
              {' · '}
              {new Date(entry.timestamp).toLocaleString(undefined, {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            {entry.details && (
              <p className="mt-1 text-sm text-muted-foreground">{entry.details}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
