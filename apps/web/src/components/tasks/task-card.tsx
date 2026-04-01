'use client';

import type { Task } from '@matanelcohen/openspace-shared';
import { Check, GitPullRequest, X } from 'lucide-react';
import Link from 'next/link';

import { AgentAvatar } from '@/components/agent-avatar';
import { PriorityBadge } from '@/components/priority-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useApproveTask, useRejectTask } from '@/hooks/use-tasks';

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDueDate(dateStr: string): string {
  const seconds = Math.floor((new Date(dateStr).getTime() - Date.now()) / 1000);
  if (seconds < 0) return formatTimeAgo(dateStr);
  if (seconds < 60) return 'in <1m';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.floor(hours / 24)}d`;
}

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  subtaskProgress?: { total: number; done: number };
  isSelected?: boolean;
  onToggleSelect?: (taskId: string) => void;
}

export function TaskCard({ task, isDragging, subtaskProgress, isSelected, onToggleSelect }: TaskCardProps) {
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();
  const isPending = task.status === 'pending';
  const isAutoPilot = task.description?.includes('🤖 Auto-assigned by Auto Pilot');

  return (
    <Card
      className={`transition-shadow ${isPending ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30' : ''} ${isDragging ? 'shadow-lg ring-2 ring-primary/20 opacity-90' : 'hover:shadow-md'} ${isPending ? '' : 'cursor-grab'}`}
      data-testid={`task-card-${task.id}`}
    >
      <CardHeader className="space-y-1 p-3 pb-1">
        <div className="flex items-start gap-1.5">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => { e.stopPropagation(); onToggleSelect(task.id); }}
              className="mt-0.5 h-3 w-3 shrink-0 rounded border-muted-foreground/30 accent-primary"
            />
          )}
        <Link
          href={`/tasks/${task.id}`}
          className="text-sm font-medium leading-tight hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {task.title}
        </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <PriorityBadge priority={task.priority} className="text-[10px] px-1.5 py-0" />
            {isAutoPilot && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                🤖 Auto Pilot
              </Badge>
            )}
          </div>
          {task.assignee && <AgentAvatar agentId={task.assignee} name={task.assignee} size="sm" />}
        </div>
        {task.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {task.labels.map((label) => (
              <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0">
                {label}
              </Badge>
            ))}
          </div>
        )}
        {task.parent && (
          <span className="text-xs text-muted-foreground">↑ subtask</span>
        )}
        {subtaskProgress && subtaskProgress.total > 0 && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{subtaskProgress.done}/{subtaskProgress.total} subtasks</span>
            <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all"
                style={{ width: `${(subtaskProgress.done / subtaskProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5 mt-1">
          {task.labels?.some((l: string) => l.startsWith('pr:')) && (
            <Badge variant="outline" className="text-[10px] px-1 py-0 gap-0.5">
              <GitPullRequest className="h-2.5 w-2.5" />
              PR #{task.labels.find((l: string) => l.startsWith('pr:'))?.split(':')[1]}
            </Badge>
          )}
          {task.dependsOn && task.dependsOn.length > 0 && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              🔗 {task.dependsOn.length} dep{task.dependsOn.length > 1 ? 's' : ''}
            </span>
          )}
          {task.status === 'delegated' && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">delegated</Badge>
          )}
          {task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done' && (
            <Badge variant="destructive" className="text-[10px] px-1 py-0">Overdue</Badge>
          )}
          {task.dueDate && new Date(task.dueDate) >= new Date() && task.status !== 'done' && (
            <span className="text-[10px] text-muted-foreground">Due {formatDueDate(task.dueDate)}</span>
          )}
          <span className="text-xs text-muted-foreground">
            {formatTimeAgo(task.updatedAt)}
          </span>
        </div>
        {isPending && (
          <div className="flex items-center gap-1.5 pt-1">
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 gap-1 border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950"
              onClick={(e) => {
                e.stopPropagation();
                approveTask.mutate(task.id);
              }}
              disabled={approveTask.isPending}
            >
              <Check className="h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 flex-1 gap-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
              onClick={(e) => {
                e.stopPropagation();
                rejectTask.mutate(task.id);
              }}
              disabled={rejectTask.isPending}
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
