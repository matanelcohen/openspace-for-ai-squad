'use client';

import React, { useMemo } from 'react';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '@matanelcohen/openspace-shared';
import { TASK_STATUS_LABELS } from '@matanelcohen/openspace-shared';

import { SortableTaskCard } from '@/components/tasks/sortable-task-card';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  subtaskCounts?: Map<string, { total: number; done: number }>;
  wipLimit?: number;
  selectedTasks?: Set<string>;
  onToggleSelect?: (taskId: string) => void;
}

const columnColors: Record<TaskStatus, string> = {
  pending: 'border-t-gray-400',
  backlog: 'border-t-indigo-500',
  'in-progress': 'border-t-blue-500',
  'in-review': 'border-t-violet-500',
  done: 'border-t-green-500',
  merged: 'border-t-emerald-500',
  blocked: 'border-t-red-500',
  delegated: 'border-t-purple-500',
};

export function KanbanColumn({ status, tasks, subtaskCounts, wipLimit, selectedTasks, onToggleSelect }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  const sortedTasks = useMemo(() => {
    const PRIORITY_ORDER: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
    return [...tasks].sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3));
  }, [tasks]);

  const taskIds = sortedTasks.map((t) => t.id);
  const isOverLimit = wipLimit !== undefined && tasks.length >= wipLimit;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[200px] w-72 flex-shrink-0 flex-col rounded-lg border border-t-4 bg-muted/30',
        columnColors[status],
        isOver && 'ring-2 ring-primary/30 bg-accent/20',
        isOverLimit && 'border-red-400/60',
      )}
      data-testid={`kanban-column-${status}`}
    >
      <div className={cn('flex items-center justify-between p-3 pb-2', isOverLimit && 'bg-red-500/10 rounded-t-lg')}>
        <h3 className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</h3>
        <span className={cn('rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground', isOverLimit && 'text-red-500 font-bold')}>
          {tasks.length}{wipLimit !== undefined ? `/${wipLimit}` : ''}
        </span>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="flex-1 space-y-2 p-2 pt-0">
          {sortedTasks.map((task, i) => {
            const prevPriority = i > 0 ? sortedTasks[i - 1]!.priority : null;
            const showDivider = prevPriority !== null && prevPriority !== task.priority;
            return (
              <React.Fragment key={task.id}>
                {showDivider && (
                  <div className="flex items-center gap-2 py-1 px-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-[10px] text-muted-foreground font-medium">{task.priority}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <SortableTaskCard task={task} subtaskProgress={subtaskCounts?.get(task.id)} isSelected={selectedTasks?.has(task.id)} onToggleSelect={onToggleSelect} />
              </React.Fragment>
            );
          })}
          {sortedTasks.length === 0 && (
            <div className="flex h-20 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
              Drop tasks here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}
