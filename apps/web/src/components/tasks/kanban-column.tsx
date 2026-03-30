'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '@openspace/shared';
import { TASK_STATUS_LABELS } from '@openspace/shared';

import { SortableTaskCard } from '@/components/tasks/sortable-task-card';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
}

const columnColors: Record<TaskStatus, string> = {
  pending: 'border-t-gray-400',
  'in-progress': 'border-t-blue-500',
  done: 'border-t-green-500',
  blocked: 'border-t-red-500',
  delegated: 'border-t-purple-500',
};

export function KanbanColumn({ status, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const taskIds = tasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[200px] w-72 flex-shrink-0 flex-col rounded-lg border border-t-4 bg-muted/30',
        columnColors[status],
        isOver && 'ring-2 ring-primary/30 bg-accent/20',
      )}
      data-testid={`kanban-column-${status}`}
    >
      <div className="flex items-center justify-between p-3 pb-2">
        <h3 className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 p-2 pt-0">
          {tasks.map((task) => (
            <SortableTaskCard key={task.id} task={task} />
          ))}
          {tasks.length === 0 && (
            <div className="flex h-20 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
