'use client';

import type { ActivityEvent } from '@matanelcohen/openspace-shared';
import { ACTIVITY_EVENT_TYPE_LABELS } from '@matanelcohen/openspace-shared';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  GitBranch,
  Lightbulb,
  Play,
  Rocket,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { AgentAvatar } from '@/components/agent-avatar';
import { useWsEvent } from '@/components/providers/websocket-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const MAX_RENDERED_ITEMS = 200;

const EVENT_ICONS: Record<string, React.ElementType> = {
  spawned: Rocket,
  started: Play,
  completed: CheckCircle2,
  failed: XCircle,
  decision: Lightbulb,
  error: AlertCircle,
};

const EVENT_COLORS: Record<string, string> = {
  spawned: 'text-blue-500',
  started: 'text-yellow-500',
  completed: 'text-green-500',
  failed: 'text-red-500',
  decision: 'text-purple-500',
  error: 'text-red-400',
};

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffSeconds = Math.floor((now - then) / 1_000);

  if (diffSeconds < 60) return 'just now';
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function ActivityEventSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3" data-testid="activity-skeleton">
      <Skeleton className="h-7 w-7 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
  );
}

interface ActivityEventItemProps {
  event: ActivityEvent;
  isNew?: boolean;
}

function ActivityEventItem({ event, isNew }: ActivityEventItemProps) {
  const Icon = EVENT_ICONS[event.type] ?? GitBranch;
  const colorClass = EVENT_COLORS[event.type] ?? 'text-muted-foreground';

  return (
    <div
      className={cn(
        'flex items-start gap-3 border-b border-border/50 p-3 transition-all duration-300',
        isNew && 'animate-in slide-in-from-top-2 fade-in-0 bg-accent/30',
      )}
      data-testid="activity-event"
    >
      <AgentAvatar agentId={event.agentId} name={event.agentId} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4 shrink-0', colorClass)} data-testid={`icon-${event.type}`} />
          <span className="truncate text-sm font-medium">
            {event.description}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {ACTIVITY_EVENT_TYPE_LABELS[event.type] ?? event.type}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {formatRelativeTime(event.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed() {
  const [liveEvents, setLiveEvents] = useState<ActivityEvent[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const newIdTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const { data: history, isLoading } = useQuery<ActivityEvent[]>({
    queryKey: ['activity'],
    queryFn: () => api.get<ActivityEvent[]>('/api/activity?limit=50'),
  });

  const handleNewActivity = useCallback((envelope: { payload: Record<string, unknown> }) => {
    const event = envelope.payload as unknown as ActivityEvent;
    if (!event?.id) return;

    setLiveEvents((prev) => [event, ...prev]);
    setNewIds((prev) => new Set(prev).add(event.id));

    const timer = setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(event.id);
        return next;
      });
      newIdTimers.current.delete(event.id);
    }, 2_000);

    newIdTimers.current.set(event.id, timer);
  }, []);

  useWsEvent('activity:new', handleNewActivity);

  useEffect(() => {
    const timers = newIdTimers.current;
    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const allEvents = [...liveEvents, ...(history ?? [])].slice(
    0,
    MAX_RENDERED_ITEMS,
  );

  if (isLoading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Activity Feed</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <ActivityEventSkeleton key={i} />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Activity Feed</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-0">
        {allEvents.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No activity yet
          </p>
        ) : (
          <>
            {allEvents.map((event) => (
              <ActivityEventItem
                key={event.id}
                event={event}
                isNew={newIds.has(event.id)}
              />
            ))}
            {allEvents.length >= MAX_RENDERED_ITEMS && (
              <div className="p-3 text-center">
                <Button variant="ghost" size="sm">
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
