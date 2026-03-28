'use client';

import { Clock, History, Play, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Textarea } from '@/components/ui/textarea';
import {
  type CronExecution,
  type CronJob,
  useCreateCronJob,
  useCronExecutions,
  useCronJobs,
  useDeleteCronJob,
  useRunCronJob,
  useToggleCronJob,
} from '@/hooks/use-cron';
import { useAgents } from '@/hooks/use-agents';

/** Simple cron next-run calculator (minute, hour, day-of-month, month, day-of-week). */
function getNextCronRuns(expr: string, count: number): Date[] {
  const parts = expr.split(/\s+/);
  if (parts.length < 5) return [];

  const parse = (field: string, min: number, max: number): number[] => {
    if (field === '*') return Array.from({ length: max - min + 1 }, (_, i) => i + min);
    const values = new Set<number>();
    for (const part of field.split(',')) {
      if (part.includes('/')) {
        const [range, step] = part.split('/');
        const s = Number(step);
        const start = range === '*' ? min : Number(range);
        for (let i = start; i <= max; i += s) values.add(i);
      } else if (part.includes('-')) {
        const [a, b] = part.split('-').map(Number);
        for (let i = a; i <= b; i++) values.add(i);
      } else {
        values.add(Number(part));
      }
    }
    return [...values].filter((v) => v >= min && v <= max).sort((a, b) => a - b);
  };

  const minutes = parse(parts[0]!, 0, 59);
  const hours = parse(parts[1]!, 0, 23);
  const daysOfMonth = parse(parts[2]!, 1, 31);
  const months = parse(parts[3]!, 1, 12);
  const daysOfWeek = parse(parts[4]!, 0, 6);

  if (!minutes.length || !hours.length) return [];

  const results: Date[] = [];
  const now = new Date();
  const cursor = new Date(now);
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  for (let i = 0; i < 60 * 24 * 60 && results.length < count; i++) {
    const m = cursor.getMinutes();
    const h = cursor.getHours();
    const dom = cursor.getDate();
    const mon = cursor.getMonth() + 1;
    const dow = cursor.getDay();

    if (
      minutes.includes(m) &&
      hours.includes(h) &&
      (parts[2] === '*' || daysOfMonth.includes(dom)) &&
      (parts[3] === '*' || months.includes(mon)) &&
      (parts[4] === '*' || daysOfWeek.includes(dow))
    ) {
      results.push(new Date(cursor));
    }
    cursor.setMinutes(cursor.getMinutes() + 1);
  }
  return results;
}

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
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Clock className="h-8 w-8" />
            Scheduled Jobs
          </h1>
          <p className="text-muted-foreground">
            Manage and monitor automated cron jobs for your squad.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          New Job
        </Button>
      </div>

      <CreateCronJobDialog open={createOpen} onOpenChange={setCreateOpen} />

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

function CreateCronJobDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { data: agents = [] } = useAgents();
  const createJob = useCreateCronJob();
  const [action, setAction] = useState<'chat' | 'task'>('chat');
  const [schedule, setSchedule] = useState('');

  const nextRuns = useMemo(() => {
    if (!schedule.trim()) return [];
    try {
      return getNextCronRuns(schedule.trim(), 3);
    } catch {
      return [];
    }
  }, [schedule]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const id = (form.get('id') as string).trim().toLowerCase().replace(/\s+/g, '-');

    createJob.mutate(
      {
        id,
        schedule: form.get('schedule') as string,
        agent: form.get('agent') as string,
        action,
        message: action === 'chat' ? (form.get('message') as string) : undefined,
        channel: action === 'chat' ? (form.get('channel') as string) || 'team' : undefined,
        title: action === 'task' ? (form.get('title') as string) : undefined,
        description: action === 'task' ? (form.get('description') as string) : undefined,
      },
      { onSuccess: () => onOpenChange(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Scheduled Job</DialogTitle>
          <DialogDescription>Set up a recurring task or message for an agent.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Job Name</label>
            <Input name="id" placeholder="daily-standup" required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Schedule (cron)</label>
            <Input
              name="schedule"
              placeholder="0 9 * * 1-5"
              required
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">e.g., &quot;0 9 * * 1-5&quot; = weekdays at 9am</p>
            {nextRuns.length > 0 && (
              <div className="rounded-md bg-muted/50 p-2 text-xs">
                <p className="font-medium text-muted-foreground mb-1">Next runs:</p>
                {nextRuns.map((d, i) => (
                  <p key={i} className="text-foreground">
                    {d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}{' '}
                    {d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </p>
                ))}
              </div>
            )}
            {schedule.trim() && nextRuns.length === 0 && (
              <p className="text-xs text-destructive">Invalid cron expression</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Agent</label>
            <Select name="agent" defaultValue="leela">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {agents.filter(a => !['scribe', 'ralph'].includes(a.id)).map(a => (
                  <SelectItem key={a.id} value={a.id}>{a.name} ({a.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Action</label>
            <Select value={action} onValueChange={(v) => setAction(v as 'chat' | 'task')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chat">Send Chat Message</SelectItem>
                <SelectItem value="task">Create Task</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {action === 'chat' ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Channel</label>
                <Input name="channel" placeholder="team" defaultValue="team" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message</label>
                <Textarea name="message" placeholder="Good morning team! Status update please." required rows={3} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Task Title</label>
                <Input name="title" placeholder="Run nightly test suite" required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea name="description" placeholder="Run all tests and report results" rows={3} />
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createJob.isPending}>
              {createJob.isPending ? 'Creating...' : 'Create Job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
