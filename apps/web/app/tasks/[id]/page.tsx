'use client';

import type { TaskStatus } from '@openspace/shared';
import { TASK_STATUS_LABELS,TASK_STATUSES } from '@openspace/shared';
import { ArrowLeft, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { AgentAvatar } from '@/components/agent-avatar';
import { PriorityBadge } from '@/components/priority-badge';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useTask, useUpdateTaskStatus } from '@/hooks/use-tasks';

export default function TaskDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: task, isLoading, error } = useTask(id);
  const updateStatus = useUpdateTaskStatus();
  const [editOpen, setEditOpen] = useState(false);

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
        <Link href="/tasks" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
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
            {task.labels.map((l) => (
              <Badge key={l} variant="secondary">{l}</Badge>
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} data-testid="edit-task-btn">
          <Pencil className="mr-1 h-3 w-3" />
          Edit
        </Button>
      </div>

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
                  <SelectItem key={s} value={s}>{TASK_STATUS_LABELS[s]}</SelectItem>
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

      {/* Description */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Description</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="task-description">
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
