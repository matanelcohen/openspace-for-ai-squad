'use client';

import type { Task } from '@openspace/shared';
import { Check, X } from 'lucide-react';
import Link from 'next/link';

import { AgentAvatar } from '@/components/agent-avatar';
import { PriorityBadge } from '@/components/priority-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { useApproveTask, useRejectTask } from '@/hooks/use-tasks';

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
}

export function TaskCard({ task, isDragging }: TaskCardProps) {
  const approveTask = useApproveTask();
  const rejectTask = useRejectTask();
  const isPending = task.status === 'pending';

  return (
    <Card
      className={`transition-shadow ${isPending ? 'border-amber-300 bg-amber-50/50 dark:border-amber-700 dark:bg-amber-950/30' : ''} ${isDragging ? 'shadow-lg ring-2 ring-primary/20 opacity-90' : 'hover:shadow-md'} ${isPending ? '' : 'cursor-grab'}`}
      data-testid={`task-card-${task.id}`}
    >
      <CardHeader className="space-y-1 p-3 pb-1">
        <Link
          href={`/tasks/${task.id}`}
          className="text-sm font-medium leading-tight hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {task.title}
        </Link>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        <div className="flex items-center justify-between gap-2">
          <PriorityBadge priority={task.priority} className="text-[10px] px-1.5 py-0" />
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
