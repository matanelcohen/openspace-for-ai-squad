'use client';

import type { SourceType } from '@matanelcohen/openspace-shared';
import { Clock, Database, FileText, HardDrive, Layers } from 'lucide-react';

import { AnimatedNumber } from '@/components/dashboard/animated-number';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useKnowledgeStats } from '@/hooks/use-knowledge';

function StatCardSkeleton() {
  return (
    <Card data-testid="knowledge-stat-skeleton">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-7 w-16" />
        <Skeleton className="mt-1 h-3 w-32" />
      </CardContent>
    </Card>
  );
}

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

const sourceTypeColors: Record<SourceType, string> = {
  commit: 'bg-blue-500',
  pull_request: 'bg-purple-500',
  doc: 'bg-green-500',
  task: 'bg-yellow-500',
  decision: 'bg-orange-500',
  voice_session: 'bg-pink-500',
  chat_thread: 'bg-cyan-500',
  agent_charter: 'bg-indigo-500',
  agent_memory: 'bg-rose-500',
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function KnowledgeStats() {
  const { data: stats, isLoading, error } = useKnowledgeStats();

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="knowledge-stats-loading">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
        data-testid="knowledge-stats-error"
      >
        <p className="text-sm text-destructive">
          Failed to load knowledge base stats: {error.message}
        </p>
      </div>
    );
  }

  if (!stats) return null;

  const sourceEntries = Object.entries(stats.chunksBySourceType ?? {}).filter(
    ([, count]) => count > 0,
  ) as [SourceType, number][];
  const totalSources = sourceEntries.length;
  const maxChunks = Math.max(...sourceEntries.map(([, count]) => count), 1);

  return (
    <div className="space-y-4" data-testid="knowledge-stats">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Chunks</CardTitle>
            <Layers className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedNumber value={stats.totalChunks ?? 0} />
            </div>
            <p className="text-xs text-muted-foreground">Indexed knowledge fragments</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memories</CardTitle>
            <Database className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedNumber value={stats.totalMemories ?? 0} />
            </div>
            <p className="text-xs text-muted-foreground">Agent memory entries</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.lastIngestedAt ? formatTimeAgo(stats.lastIngestedAt) : 'Never'}
            </div>
            <p className="text-xs text-muted-foreground">Last ingestion time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sources</CardTitle>
            <FileText className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <AnimatedNumber value={totalSources} />
            </div>
            <p className="text-xs text-muted-foreground">Active source types</p>
          </CardContent>
        </Card>
      </div>

      {/* Source Breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Source Breakdown</CardTitle>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HardDrive className="h-3 w-3" />
              {stats.vectorStoreProvider ?? 'sqlite-vec'} ·{' '}
              {stats.embeddingModel ?? 'text-embedding-3-small'}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sourceEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sources ingested yet.</p>
          ) : (
            <div className="space-y-3">
              {sourceEntries
                .sort(([, a], [, b]) => b - a)
                .map(([sourceType, count]) => (
                  <div key={sourceType} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {sourceTypeLabels[sourceType] ?? sourceType}
                      </span>
                      <span className="font-medium tabular-nums">{count.toLocaleString()}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted">
                      <div
                        className={`h-2 rounded-full transition-all ${sourceTypeColors[sourceType] ?? 'bg-gray-500'}`}
                        style={{ width: `${(count / maxChunks) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
