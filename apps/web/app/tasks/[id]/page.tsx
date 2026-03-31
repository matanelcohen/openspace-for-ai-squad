'use client';

import type { TaskStatus } from '@matanelcohen/openspace-shared';
import { TASK_STATUS_LABELS, TASK_STATUSES } from '@matanelcohen/openspace-shared';
import { ArrowLeft, Box, ChevronDown, ChevronRight, ClipboardCopy, Code2, GitBranch, GitPullRequest, Loader2, Network, Pencil, Play, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { AgentAvatar } from '@/components/agent-avatar';
import { PriorityBadge } from '@/components/priority-badge';
import { TaskDependencyGraph } from '@/components/tasks/task-dependency-graph';
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
import { useAgentStatus } from '@/hooks/use-agent-status';
import { useAgents } from '@/hooks/use-agents';
import { useCreateBranch, useCreatePR } from '@/hooks/use-github';
import { useTaskEvents } from '@/hooks/use-task-events';
import { useDeleteTask, useEnqueueTask, useSubtasks, useTask, useTaskDependencyGraph, useUpdateTask, useUpdateTaskStatus } from '@/hooks/use-tasks';
import { useWorktree } from '@/hooks/use-worktrees';
import { selectTier } from '@/lib/tiers';
import { api } from '@/lib/api-client';

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
  const { data: agentStatusData } = useAgentStatus();
  const createBranch = useCreateBranch();
  const createPR = useCreatePR();
  const { data: subtasks } = useSubtasks(id);
  const { data: worktree } = useWorktree(id);
  const { data: depGraphTasks } = useTaskDependencyGraph(id);
  const [showPrompt, setShowPrompt] = useState(false);
  const [promptData, setPromptData] = useState<Record<string, unknown> | null>(null);
  const [promptLoading, setPromptLoading] = useState(false);
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
    // Strip all agent execution history — keep only the original description
    const cleanDesc = task.description
      .replace(/\n\n---\n\*\*\[[\s\S]*$/g, '') // Remove everything after first --- history marker
      .replace(/\n\n\*\*History:\*\*[\s\S]*$/g, '') // Remove history section
      .replace(/\n\n\*\*Progress:\*\*[\s\S]*$/g, '') // Remove progress section  
      .replace(/\n\n\*\*Result:\*\*[\s\S]*$/g, '') // Remove result section
      .trimEnd();

    updateTask.mutate(
      {
        taskId: task.id,
        title: task.title,
        description: cleanDesc || task.title,
        assignee: null,
        priority: task.priority,
        labels: task.labels,
      },
      {
        onSuccess: () => {
          updateStatus.mutate({ taskId: task.id, status: 'pending' });
          clearEvents();
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

      {/* Stuck in-progress banner — task has no active worker for 30s+ */}
      {task.status === 'in-progress' && !isWorking && (() => {
        // Check if any agent is actively working on this task via API
        const agents = agentStatusData?.agents ?? {};
        const agentWorking = Object.values(agents).some(
          (info) => info.activeTask?.id === task.id,
        );
        if (agentWorking) return false; // Agent IS working, just no WS events yet

        const updated = new Date(task.updatedAt).getTime();
        const elapsed = Date.now() - updated;
        return elapsed > 30_000;
      })() && (
        <div
          className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950"
        >
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              ⏳ This task appears stuck
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No agent is actively working on it. It may have been interrupted by a server restart.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetryTask}
            disabled={updateTask.isPending || updateStatus.isPending}
            className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {updateTask.isPending ? 'Resetting...' : 'Reset to Pending'}
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

      {/* Full Agent Prompt */}
      <Card data-testid="prompt-section">
        <CardHeader
          className="cursor-pointer pb-2"
          onClick={async () => {
            if (!showPrompt && !promptData) {
              setPromptLoading(true);
              try {
                const data = await api.get<Record<string, unknown>>(`/api/tasks/${id}/prompt`);
                setPromptData(data);
              } catch {
                setPromptData({ error: 'No prompt data available. Task may not have been executed yet.' });
              }
              setPromptLoading(false);
            }
            setShowPrompt(!showPrompt);
          }}
        >
          <CardTitle className="flex items-center gap-2 text-sm">
            {showPrompt ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <Code2 className="h-4 w-4" />
            Full Agent Prompt
            {promptLoading && <Loader2 className="h-3 w-3 animate-spin" />}
          </CardTitle>
        </CardHeader>
        {showPrompt && promptData && (
          <CardContent>
            {!promptData.error && (
              <div className="flex justify-end mb-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    const text = JSON.stringify(promptData, null, 2);
                    navigator.clipboard.writeText(text);
                  }}
                >
                  <ClipboardCopy className="h-3 w-3" />
                  Copy Prompt
                </Button>
              </div>
            )}
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-4 text-xs">
                {promptData.error ? (
                  <p className="text-muted-foreground italic">{String(promptData.error)}</p>
                ) : (
                  <>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">Agent</h4>
                      <p className="font-mono">{String(promptData.agentName)} ({String(promptData.agentRole)})</p>
                      <p className="text-muted-foreground mt-0.5">{String(promptData.personality)}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-1">System Prompt</h4>
                      <pre className="whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs overflow-auto">
                        {String(promptData.systemPrompt)}
                      </pre>
                    </div>

                    <div>
                      <h4 className="font-semibold text-sm mb-1">User Message</h4>
                      <pre className="whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs overflow-auto">
                        {String(promptData.userMessage)}
                      </pre>
                    </div>

                    {Array.isArray(promptData.skills) && (promptData.skills as Array<Record<string, string>>).length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Skills ({(promptData.skills as unknown[]).length})</h4>
                        <div className="space-y-1">
                          {(promptData.skills as Array<Record<string, string>>).map((s, i) => (
                            <div key={i} className="flex gap-2">
                              <Badge variant="outline" className="text-xs font-mono">{s.id}</Badge>
                              <span className="text-muted-foreground">{s.description?.substring(0, 100)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {Array.isArray(promptData.memories) && (promptData.memories as unknown[]).length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm mb-1">Memories ({(promptData.memories as unknown[]).length})</h4>
                        <pre className="whitespace-pre-wrap rounded bg-muted p-3 font-mono text-xs overflow-auto">
                          {String(promptData.memoriesPrompt)}
                        </pre>
                      </div>
                    )}

                    <div className="flex gap-4 text-muted-foreground">
                      <span>Tier: <span className="font-mono">{String(promptData.tier)}</span></span>
                      {typeof promptData.branch === 'string' && <span>Branch: <span className="font-mono">{promptData.branch}</span></span>}
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        )}
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

      {/* Sandbox (Worktree) */}
      {worktree && (
        <Card data-testid="sandbox-section">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Box className="h-4 w-4" />
              Sandbox
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                <GitBranch className="mr-1 h-3 w-3" />
                {worktree.branch}
              </Badge>
              <span className="text-muted-foreground text-xs">
                from <span className="font-mono">{worktree.baseBranch}</span>
              </span>
            </div>
            {worktree.pr && (
              <div className="flex items-center gap-2">
                <GitPullRequest className="h-3 w-3 text-green-600" />
                <a
                  href={worktree.pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                >
                  PR #{worktree.pr.number}
                </a>
              </div>
            )}
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
                    head: worktree?.branch ?? `task/${task.id}`,
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

      {/* Dependency Graph */}
      {depGraphTasks && depGraphTasks.length > 1 && (
        <Card data-testid="dependency-graph-section">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Network className="h-4 w-4" />
              Dependency Graph
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TaskDependencyGraph
              tasks={depGraphTasks}
              currentTaskId={id}
            />
          </CardContent>
        </Card>
      )}

      {/* Description */}
      {(() => {
        const raw = task.description ?? '';
        const sepIdx = raw.indexOf('\n\n---\n');
        const info = sepIdx >= 0 ? raw.substring(0, sepIdx).trim() : raw.trim();
        const runLog = sepIdx >= 0 ? raw.substring(sepIdx + 5).trim() : '';
        return (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none"
                  data-testid="task-description"
                >
                  {info ? (
                    <Markdown remarkPlugins={[remarkGfm]}>{info}</Markdown>
                  ) : (
                    <p className="text-muted-foreground italic">No description provided.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {runLog && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Play className="h-4 w-4" />
                    Agent Run Log
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="max-h-96">
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-xs"
                      data-testid="agent-run-log"
                    >
                      <Markdown remarkPlugins={[remarkGfm]}>{runLog}</Markdown>
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </>
        );
      })()}

      {/* Timestamps */}
      <div className="flex gap-6 text-xs text-muted-foreground" data-testid="task-timestamps">
        <span>Created: {new Date(task.createdAt).toLocaleString()}</span>
        <span>Updated: {new Date(task.updatedAt).toLocaleString()}</span>
      </div>

      <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} task={task} />
    </div>
  );
}
