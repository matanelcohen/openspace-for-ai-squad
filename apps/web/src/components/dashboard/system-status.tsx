'use client';

import { Clock, Server } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useCronJobs } from '@/hooks/use-cron';
import { useSystemConfig } from '@/hooks/use-settings';

export function SystemStatus() {
  const { data: cronJobs, isLoading: cronLoading } = useCronJobs();
  const { data: config, isLoading: configLoading } = useSystemConfig();

  const enabledJobs = cronJobs?.filter((j) => j.enabled) ?? [];
  const nextJob = enabledJobs
    .filter((j) => j.nextRunAt)
    .sort((a, b) => new Date(a.nextRunAt!).getTime() - new Date(b.nextRunAt!).getTime())[0];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Link href="/cron">
        <Card className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled Jobs</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {cronLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">{enabledJobs.length}</div>
                <p className="text-xs text-muted-foreground">
                  {nextJob
                    ? `Next: ${nextJob.name}`
                    : 'No upcoming jobs'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </Link>

      <Link href="/settings">
        <Card className="transition-all hover:shadow-md hover:border-primary/30 cursor-pointer">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Model Status</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {configLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {config?.model ?? 'Default'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {config?.failoverActive
                    ? '⚠ Failover active'
                    : '✓ Normal operation'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
