'use client';

import type { TaskStatus } from '@openspace/shared';
import { TASK_STATUS_LABELS, TASK_STATUSES } from '@openspace/shared';
import { ArrowLeft, GitBranch, GitPullRequest, Loader2, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { AgentAvatar } from '@/components/agent-avatar';
import { PriorityBadge } from '@/components/priority-badge';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgents } from '@/hooks/use-agents';
import { useCreateBranch, useCreatePR } from '@/hooks/use-github';
import { useTaskEvents } from '@/hooks/use-task-events';
import { useDeleteTask, useEnqueueTask, useSubtasks, useTask, useUpdateTask, useUpdateTaskStatus } from '@/hooks/use-tasks';
import { selectTier } from '@/lib/tiers';

export default function TaskDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: task, isLoading, error } = useTask(id);
  const updateStatus = useUpdateTaskStatus();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const enqueueTask = useEnqueueTask();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const { data: agents } = useAgents();
  const { events, isWorking, clearEvents } = useTaskEvents(id);
  const createBranch = useCreateBranch();
  const createPR = useCreatePR();
  const { data: subtasks } = useSubtasks(id);
  const logEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll progress log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  const handleAssignAndRun = async () => {
    if (!task || !selectedAgent) return;
    clearEvents();
    enqueueTask.mutate({ taskId: task.id, agentId: selectedAgent });
  };

  const handleDelete = async () => {
    if (!task || !confirm(`Delete "${task.title}"? This cannot be undone.`)) return;
    try {
      await deleteTask.mutateAsync(task.id);
      router.push('/tasks');
    } catch {
      /* handled by react-query */
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="task-detail-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="space-y-4" data-testid="task-detail-error">
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to tasks
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            {error ? `Failed to load task: ${error.message}` : 'Task not found.'}
          </p>
        </div>
      </div>
    );
  }

  function handleStatusChange(newStatus: string) {
    if (task) {
      updateStatus.mutate({ taskId: task.id, status: newStatus as TaskStatus });
    }
  }

  function handleRetryTask() {
    if (!task) return;
    // Clear the failed attempts from description and reset to backlog
    const cleanDesc = task.description
      .replace(/\n---\n\*\*\[.*?\]\*\* 🚀.*?started working.*$/gm, '')
      .replace(/\n---\n\*\*\[.*?\]\*\* 🛑.*?Permanently blocked.*$/gm, '')
      .replace(/\n---\n\*\*\[.*?\]\*\* ❌.*$/gm, '')
      .replace(/\n\n---\n\*\*Diagnosis:.*$/gm, '')
      .replace(/\n\n---\n\*\*Last known error:.*$/gm, '')
      .replace(/\n\n---\n\*\*Execution log:[\s\S]*?(?=\n\n---|$)/g, '')
      .replace(/\n\n\*\*Error:\*\*[\s\S]*?(?=\n\n---|$)/g, '')
      .replace(/\n\n\*\*Stack:\*\*[\s\S]*?(?=\n\n---|$)/g, '')
      .trimEnd();

    updateTask.mutate(
      {
        taskId: task.id,
        title: task.title,
        description:
          cleanDesc +
          `\n\n---\n**[${new Date().toISOString().replace('T', ' ').substring(0, 19)}]** 🔄 Task reset and re-queued by user.`,
        assignee: task.assignee,
        priority: task.priority,
        labels: task.labels,
      },
      {
        onSuccess: () => {
          updateStatus.mutate({ taskId: task.id, status: 'pending' });
        },
      },
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="task-detail-page">
      {/* Back nav */}
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        data-testid="back-to-board"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tasks
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="task-title">
            {task.title}
          </h1>
          <div className="flex items-center gap-2">
            <PriorityBadge priority={task.priority} />
            {(() => {
              const tierInfo = selectTier({
                title: task.title,
                description: task.description,
                priority: task.priority,
              });
              return (
                <Badge className={tierInfo.color} data-testid="tier-badge">
                  {tierInfo.label}
                </Badge>
              );
            })()}
            {task.labels.map((l) => (
              <Badge key={l} variant="secondary">
                {l}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            data-testid="edit-task-btn"
          >
            <Pencil className="mr-1 h-3 w-3" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleteTask.isPending}
            className="text-destructive hover:bg-destructive/10"
            data-testid="delete-task-btn"
          >
            <Trash2 className="mr-1 h-3 w-3" />
            {deleteTask.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </div>

      {/* Blocked task banner with retry button */}
      {task.status === 'blocked' && (
        <div
          className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950"
          data-testid="blocked-banner"
        >
          <div>
            <p className="text-sm font-medium text-red-800 dark:text-red-200">
              ⚠️ This task is blocked
            </p>
            <p className="text-xs text-red-600 dark:text-red-400">
              The agent failed to complete this task. You can reset and retry it.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetryTask}
            disabled={updateTask.isPending || updateStatus.isPending}
            className="gap-1.5 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900"
            data-testid="retry-task-btn"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {updateTask.isPending ? 'Resetting...' : 'Retry Task'}
          </Button>
        </div>
      )}

      {/* Controls row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Select value={task.status} onValueChange={handleStatusChange}>
              <SelectTrigger data-testid="status-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {TASK_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Assignee</CardTitle>
          </CardHeader>
          <CardContent>
            {task.assignee ? (
              <div className="flex items-center gap-2">
                <AgentAvatar agentId={task.assignee} name={task.assignee} size="sm" />
                <span className="text-sm capitalize">{task.assignee}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">Unassigned</span>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <PriorityBadge priority={task.priority} />
          </CardContent>
        </Card>
      </div>

      {/* Assign to Agent */}
      <Card data-testid="assign-agent-section">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Assign to Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-64" data-testid="agent-select">
                <SelectValue placeholder="Select an agent…" />
              </SelectTrigger>
              <SelectContent>
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{agent.name}</span>
                      <span className="text-muted-foreground">· {agent.role}</span>
                      <Badge
                        variant={agent.status === 'idle' ? 'secondary' : 'default'}
                        className="ml-1 text-[10px] px-1.5 py-0"
                      >
                        {agent.status}
                      </Badge>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              disabled={!selectedAgent || enqueueTask.isPending}
              onClick={handleAssignAndRun}
              data-testid="assign-run-btn"
            >
              <Play className="mr-1 h-3 w-3" />
              {enqueueTask.isPending ? 'Assigning…' : 'Assign & Run'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live Progress Panel */}
      {(isWorking || events.length > 0) && (
        <Card data-testid="progress-panel">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Agent Progress</CardTitle>
              {isWorking && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Agent is working…
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64 rounded-md border bg-muted/30 p-3">
              <div className="space-y-1 font-mono text-xs">
                {events.map((event, i) => (
                  <div key={i} className="leading-relaxed">
                    <span className="text-muted-foreground mr-2">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </span>
                    {event.message}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* GitHub Integration */}
      <Card data-testid="github-section">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <GitBranch className="h-4 w-4" />
            GitHub
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            {/* Linked issue badge */}
            {task.labels
              .filter((l) => l.startsWith('github-issue:'))
              .map((l) => (
                <Badge key={l} variant="outline" className="text-xs">
                  Issue #{l.split(':')[1]}
                </Badge>
              ))}

            <Button
              variant="outline"
              size="sm"
              disabled={createBranch.isPending}
              onClick={() => createBranch.mutate({ taskId: task.id })}
              data-testid="create-branch-btn"
            >
              <GitBranch className="mr-1 h-3 w-3" />
              {createBranch.isPending ? 'Creating…' : 'Create Branch'}
            </Button>

            {createBranch.isSuccess && (
              <Badge variant="secondary" className="text-xs font-mono">
                {createBranch.data.branch}
              </Badge>
            )}

            {task.status === 'done' && (
              <Button
                variant="outline"
                size="sm"
                disabled={createPR.isPending}
                onClick={() =>
                  createPR.mutate({
                    taskId: task.id,
                    head: `agent/${task.id}`,
                  })
                }
                data-testid="create-pr-btn"
              >
                <GitPullRequest className="mr-1 h-3 w-3" />
                {createPR.isPending ? 'Creating…' : 'Create PR'}
              </Button>
            )}

            {createPR.isSuccess && (
              <a
                href={createPR.data.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                PR #{createPR.data.number}
              </a>
            )}

            {(createBranch.isError || createPR.isError) && (
              <span className="text-xs text-destructive">
                {(createBranch.error as Error)?.message ??
                  (createPR.error as Error)?.message ??
                  'Operation failed'}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Subtasks Section */}
      {subtasks && subtasks.length > 0 && (
        <Card data-testid="subtasks-section">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Subtasks</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Progress bar */}
            {(() => {
              const doneCount = subtasks.filter((s) => s.status === 'done').length;
              const total = subtasks.length;
              const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;
              return (
                <div className="space-y-1" data-testid="subtask-progress">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{doneCount} of {total} subtasks complete</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })()}

            {/* Subtask list */}
            <div className="divide-y rounded-md border">
              {subtasks.map((sub) => (
                <Link
                  key={sub.id}
                  href={`/tasks/${sub.id}`}
                  className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
                  data-testid={`subtask-${sub.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm truncate">{sub.title}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {sub.assignee && (
                      <div className="flex items-center gap-1">
                        <AgentAvatar agentId={sub.assignee} name={sub.assignee} size="sm" />
                        <span className="text-xs text-muted-foreground capitalize">{sub.assignee}</span>
                      </div>
                    )}
                    <Badge
                      variant={
                        sub.status === 'done'
                          ? 'default'
                          : sub.status === 'blocked'
                            ? 'destructive'
                            : sub.status === 'in-progress'
                              ? 'default'
                              : 'secondary'
                      }
                      className={
                        sub.status === 'done'
                          ? 'bg-green-600 text-white'
                          : sub.status === 'in-progress'
                            ? 'bg-blue-600 text-white'
                            : ''
                      }
                    >
                      {sub.status}
                    </Badge>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="prose prose-sm dark:prose-invert max-w-none"
            data-testid="task-description"
          >
            {task.description ? (
              <Markdown remarkPlugins={[remarkGfm]}>{task.description}</Markdown>
            ) : (
              <p className="text-muted-foreground italic">No description provided.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Timestamps */}
      <div className="flex gap-6 text-xs text-muted-foreground" data-testid="task-timestamps">
        <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
        <span>Updated: {new Date(task.updatedAt).toLocaleString()}</span>
      </div>

      <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
    </div>
  );
}
