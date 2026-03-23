'use client';

import type { Task } from '@openspace/shared';

import { AgentAvatar } from '@/components/agent-avatar';
import { PriorityBadge } from '@/components/priority-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
}

export function TaskCard({ task, isDragging }: TaskCardProps) {
  return (
    <Card
      className={`cursor-grab transition-shadow ${isDragging ? 'shadow-lg ring-2 ring-primary/20 opacity-90' : 'hover:shadow-md'}`}
      data-testid={`task-card-${task.id}`}
    >
      <CardHeader className="space-y-1 p-3 pb-1">
        <p className="text-sm font-medium leading-tight">{task.title}</p>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        <div className="flex items-center justify-between gap-2">
          <PriorityBadge priority={task.priority} className="text-[10px] px-1.5 py-0" />
          {task.assignee && (
            <AgentAvatar agentId={task.assignee} name={task.assignee} size="sm" />
          )}
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
      </CardContent>
    </Card>
  );
}
