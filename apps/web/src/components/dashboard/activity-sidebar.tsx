'use client';

import { Activity } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  getActivityEmoji,
  useActivityFeed,
  type ActivityEvent,
} from '@/hooks/use-activity-feed';

// ── Helpers ─────────────────────────────────────────────────────────

function formatTime(timestamp: string): string {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

const TYPE_COLORS: Record<ActivityEvent['type'], string> = {
  task_start: 'text-yellow-600 dark:text-yellow-400',
  task_complete: 'text-green-600 dark:text-green-400',
  tool_use: 'text-blue-600 dark:text-blue-400',
  chat_message: 'text-purple-600 dark:text-purple-400',
  thinking: 'text-muted-foreground',
};

// ── Entry component ─────────────────────────────────────────────────

function ActivityEntry({ event }: { event: ActivityEvent }) {
  const emoji = getActivityEmoji(event.type);
  const colorClass = TYPE_COLORS[event.type] ?? 'text-muted-foreground';

  return (
    <div
      className="flex items-start gap-1.5 px-3 py-1.5 text-xs leading-snug animate-in slide-in-from-bottom-1 fade-in-0 duration-200"
      data-testid="activity-entry"
    >
      <span className="shrink-0 select-none" aria-hidden>
        {emoji}
      </span>
      <span className={cn('min-w-0 break-words', colorClass)}>
        {event.message}
      </span>
      <span className="ml-auto shrink-0 tabular-nums text-[10px] text-muted-foreground/60">
        {formatTime(event.timestamp)}
      </span>
    </div>
  );
}

// ── Sidebar component ───────────────────────────────────────────────

export function DashboardActivitySidebar() {
  const events = useActivityFeed(50);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [events.length]);

  return (
    <Card className="flex h-full flex-col" data-testid="dashboard-activity-sidebar">
      <CardHeader className="pb-2 pt-3 px-3">
        <CardTitle className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <Activity className="h-3.5 w-3.5" />
          Live Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto"
          data-testid="activity-scroll"
        >
          {events.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground/60">
              Waiting for activity…
            </p>
          ) : (
            <div className="divide-y divide-border/30">
              {events.map((event) => (
                <ActivityEntry key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
