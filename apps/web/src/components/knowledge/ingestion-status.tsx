'use client';

import type { SourceType } from '@matanelcohen/openspace-shared';
import { CheckCircle2, CircleDashed, Loader2, Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useKnowledgeStats } from '@/hooks/use-knowledge';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

const sourceTypeLabels: Record<SourceType, string> = {
  commit: 'Commits',
  pull_request: 'Pull Requests',
  doc: 'Documents',
  task: 'Tasks',
  decision: 'Decisions',
  voice_session: 'Voice Sessions',
  chat_thread: 'Chat Threads',
  agent_charter: 'Agent Charters',
  agent_memory: 'Agent Memories',
};

const allSourceTypes: SourceType[] = [
  'commit',
  'pull_request',
  'doc',
  'task',
  'decision',
  'voice_session',
  'chat_thread',
  'agent_charter',
  'agent_memory',
];

function IngestionSkeleton() {
  return (
    <Card data-testid="ingestion-status-skeleton">
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function IngestionStatus() {
  const { data: stats, isLoading, error, dataUpdatedAt, refetch } = useKnowledgeStats();
  const [ingesting, setIngesting] = useState(false);

  const handleIngest = async () => {
    setIngesting(true);
    try {
      await api.post('/api/knowledge/ingest', {});
      // Don't refetch immediately — wait for WebSocket progress
      // Poll stats every 3s while ingesting
      const poll = setInterval(async () => {
        await refetch();
      }, 3000);
      // Stop polling after 2 minutes max
      setTimeout(() => {
        clearInterval(poll);
        setIngesting(false);
        void refetch();
      }, 120_000);
      // Also listen for completion (ingesting state cleared by WS in the future)
      setTimeout(() => {
        void refetch();
        setIngesting(false);
      }, 5000);
    } catch {
      setIngesting(false);
    }
  };

  if (isLoading) {
    return <IngestionSkeleton />;
  }

  if (error) {
    return (
      <Card data-testid="ingestion-status-error">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Ingestion Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const chunks = stats.chunksBySourceType ?? {};

  return (
    <Card data-testid="ingestion-status">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            Ingestion Status
          </CardTitle>
          {dataUpdatedAt > 0 && (
            <span className="text-[10px] text-muted-foreground tabular-nums">
              Polled {new Date(dataUpdatedAt).toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleIngest}
            disabled={ingesting}
            className="h-7 text-xs"
          >
            {ingesting ? (
              <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Indexing…</>
            ) : (
              <><Play className="mr-1 h-3 w-3" /> Index Now</>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {allSourceTypes.map((sourceType) => {
            const count = chunks[sourceType] ?? 0;
            const isIngested = count > 0;

            return (
              <div
                key={sourceType}
                className={cn(
                  'flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors',
                  isIngested ? 'bg-green-500/5' : 'bg-muted/30',
                )}
              >
                <div className="flex items-center gap-2">
                  {isIngested ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <CircleDashed className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className={cn(!isIngested && 'text-muted-foreground')}>
                    {sourceTypeLabels[sourceType]}
                  </span>
                </div>
                {isIngested ? (
                  <Badge variant="secondary" className="text-xs tabular-nums">
                    {count.toLocaleString()} chunks
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">Not ingested</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
