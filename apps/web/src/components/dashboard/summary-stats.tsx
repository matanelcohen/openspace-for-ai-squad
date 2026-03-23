'use client';

import { Activity, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

import { AnimatedNumber } from '@/components/dashboard/animated-number';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSquad } from '@/hooks/use-squad';

function StatCardSkeleton() {
  return (
    <Card data-testid="stat-card-skeleton">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-7 w-12" />
        <Skeleton className="mt-1 h-3 w-32" />
      </CardContent>
    </Card>
  );
}

const statConfig = [
  {
    key: 'inProgress' as const,
    label: 'In Progress',
    icon: Activity,
    description: 'Tasks being worked on',
    color: 'text-blue-500',
  },
  {
    key: 'done' as const,
    label: 'Completed',
    icon: CheckCircle,
    description: 'Tasks completed',
    color: 'text-green-500',
  },
  {
    key: 'decisions' as const,
    label: 'Decisions',
    icon: Clock,
    description: 'Recent decisions',
    color: 'text-yellow-500',
  },
  {
    key: 'failed' as const,
    label: 'Issues',
    icon: AlertTriangle,
    description: 'Failed agents',
    color: 'text-red-500',
  },
];

export function SummaryStats() {
  const { data: squad, isLoading, error } = useSquad();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="summary-stats-loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4" data-testid="summary-stats-error">
        <p className="text-sm text-destructive">
          Failed to load squad overview: {error.message}
        </p>
      </div>
    );
  }

  const counts = squad?.taskCounts?.byStatus;
  const failedAgents = squad?.agents?.filter((a) => a.status === 'failed').length ?? 0;

  const values = {
    inProgress: counts?.['in-progress'] ?? 0,
    done: counts?.done ?? 0,
    decisions: squad?.recentDecisions?.length ?? 0,
    failed: failedAgents,
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="summary-stats">
      {statConfig.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <AnimatedNumber value={values[stat.key]} />
              </div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
