'use client';

import { AgentCard } from '@/components/dashboard/agent-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgents } from '@/hooks/use-agents';

function AgentCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm" data-testid="agent-card-skeleton">
      <div className="flex items-center gap-3">
        <Skeleton className="h-14 w-14 rounded-full" />
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-12 w-full rounded-md" />
        <div className="flex gap-1">
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-18 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export function AgentGrid() {
  const { data: agents, isLoading, error } = useAgents();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="agent-grid-loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <AgentCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4" data-testid="agent-grid-error">
        <p className="text-sm text-destructive">
          Failed to load agents: {error.message}
        </p>
      </div>
    );
  }

  if (!agents?.length) {
    return (
      <div className="rounded-lg border bg-muted/50 p-8 text-center" data-testid="agent-grid-empty">
        <p className="text-muted-foreground">No agents found.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" data-testid="agent-grid">
      {agents.map((agent) => (
        <AgentCard key={agent.id} agent={agent} />
      ))}
    </div>
  );
}
