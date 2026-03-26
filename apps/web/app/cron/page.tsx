'use client';

import { Clock, History, Play, RefreshCw } from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type CronExecution,
  type CronJob,
  useCronExecutions,
  useCronJobs,
  useRunCronJob,
  useToggleCronJob,
} from '@/hooks/use-cron';

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'success'
      ? 'default'
      : status === 'failure'
        ? 'destructive'
        : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

function formatRelativeTime(dateStr?: string): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function CronJobRow({ job }: { job: CronJob }) {
  const toggleMutation = useToggleCronJob();
  const runMutation = useRunCronJob();
  const [runningId, setRunningId] = useState<string | null>(null);

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      await runMutation.mutateAsync(id);
    } finally {
      setRunningId(null);
    }
  };

  return (
    <TableRow data-testid={`cron-job-${job.id}`}>
      <TableCell className="font-medium">{job.name}</TableCell>
      <TableCell>
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {job.scheduleHuman ?? job.schedule}
        </code>
      </TableCell>
      <TableCell>{job.agentName ?? job.agentId ?? '—'}</TableCell>
      <TableCell>
        <Badge variant="outline">{job.actionType}</Badge>
      </TableCell>
      <TableCell>
        <Switch
          checked={job.enabled}
          onCheckedChange={(enabled) =>
            toggleMutation.mutate({ id: job.id, enabled })
          }
          disabled={toggleMutation.isPending}
          aria-label={`Toggle ${job.name}`}
        />
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatRelativeTime(job.lastRunAt)}
        {job.lastRunStatus && (
          <span className="ml-2">
            <StatusBadge status={job.lastRunStatus} />
          </span>
        )}
      </TableCell>
      <TableCell>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void handleRun(job.id)}
          disabled={runningId === job.id || runMutation.isPending}
        >
          {runningId === job.id ? (
            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Play className="mr-1 h-3 w-3" />
          )}
          Run Now
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ExecutionHistory({ executions }: { executions?: CronExecution[] }) {
  if (!executions?.length) {
    return (
      <EmptyState
        icon={History}
        title="No executions yet"
        description="Run a scheduled job to see execution history here."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Job</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>Error</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {executions.slice(0, 20).map((exec) => (
          <TableRow key={exec.id}>
            <TableCell className="font-medium">{exec.jobName}</TableCell>
            <TableCell>
              <StatusBadge status={exec.status} />
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {formatRelativeTime(exec.startedAt)}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {exec.durationMs != null ? `${(exec.durationMs / 1000).toFixed(1)}s` : '—'}
            </TableCell>
            <TableCell className="max-w-[200px] truncate text-sm text-destructive">
              {exec.error ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function CronPage() {
  const { data: jobs, isLoading: jobsLoading } = useCronJobs();
  const { data: executions, isLoading: execLoading } = useCronExecutions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Clock className="h-8 w-8" />
          Scheduled Jobs
        </h1>
        <p className="text-muted-foreground">
          Manage and monitor automated cron jobs for your squad.
        </p>
      </div>

      <Tabs defaultValue="jobs">
        <TabsList>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
          <TabsTrigger value="history">Execution History</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cron Jobs</CardTitle>
            </CardHeader>
            <CardContent>
              {jobsLoading ? (
                <LoadingSpinner message="Loading cron jobs…" />
              ) : !jobs?.length ? (
                <EmptyState
                  icon={Clock}
                  title="No cron jobs configured"
                  description="Scheduled jobs will appear here once configured in the backend."
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead>Last Run</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobs.map((job) => (
                      <CronJobRow key={job.id} job={job} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Executions</CardTitle>
            </CardHeader>
            <CardContent>
              {execLoading ? (
                <LoadingSpinner message="Loading execution history…" />
              ) : (
                <ExecutionHistory executions={executions} />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
