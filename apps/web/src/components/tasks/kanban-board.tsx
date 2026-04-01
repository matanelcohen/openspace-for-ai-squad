'use client';

import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { TaskStatus } from '@matanelcohen/openspace-shared';
import { TASK_STATUSES } from '@matanelcohen/openspace-shared';
import { useMemo, useState } from 'react';

import { KanbanColumn } from '@/components/tasks/kanban-column';
import { TaskCard } from '@/components/tasks/task-card';
import { type TaskFilters, TaskFiltersToolbar } from '@/components/tasks/task-filters-toolbar';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasks, useUpdateTaskPriority, useUpdateTaskStatus } from '@/hooks/use-tasks';
import { applyFilters } from '@/lib/task-filters';

const DEFAULT_FILTERS: TaskFilters = {
  status: 'all',
  assignee: 'all',
  priority: 'all',
  search: '',
};

const DEFAULT_WIP_LIMITS: Record<string, number> = { 'in-progress': 5 };

interface KanbanBoardProps {
  wipLimits?: Record<string, number>;
}

export function KanbanBoard({ wipLimits = DEFAULT_WIP_LIMITS }: KanbanBoardProps) {
  const { data: tasks, isLoading, error } = useTasks();
  const updateStatus = useUpdateTaskStatus();
  const updatePriority = useUpdateTaskPriority();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>(DEFAULT_FILTERS);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    return applyFilters(tasks, filters);
  }, [tasks, filters]);

  // Compute subtask counts per parent task
  const subtaskCounts = useMemo(() => {
    const counts = new Map<string, { total: number; done: number }>();
    for (const t of tasks ?? []) {
      const parentLabel = t.labels?.find((l: string) => l.startsWith('parent:'));
      if (parentLabel) {
        const parentId = parentLabel.replace('parent:', '');
        const existing = counts.get(parentId) ?? { total: 0, done: 0 };
        existing.total++;
        if (t.status === 'done') existing.done++;
        counts.set(parentId, existing);
      }
    }
    return counts;
  }, [tasks]);

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.assignee !== 'all' ||
    filters.priority !== 'all' ||
    filters.search !== '';

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-loading">
        {TASK_STATUSES.map((status) => (
          <div key={status} className="w-72 flex-shrink-0 space-y-2 rounded-lg border p-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
        data-testid="kanban-error"
      >
        <p className="text-sm text-destructive">Failed to load tasks: {error.message}</p>
      </div>
    );
  }

  const tasksByStatus = TASK_STATUSES.reduce(
    (acc, status) => {
      acc[status] = filteredTasks
        .filter((t) => t.status === status)
        .sort((a, b) => a.sortIndex - b.sortIndex);
      return acc;
    },
    {} as Record<TaskStatus, typeof tasks>,
  );

  const activeTask = activeTaskId ? tasks?.find((t) => t.id === activeTaskId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveTaskId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const task = tasks?.find((t) => t.id === taskId);
    if (!task) return;

    // Determine target column
    let newStatus: TaskStatus;
    if (TASK_STATUSES.includes(over.id as TaskStatus)) {
      newStatus = over.id as TaskStatus;
    } else {
      const overTask = tasks?.find((t) => t.id === over.id);
      newStatus = overTask?.status ?? task.status;
    }

    // Cross-column move: change status
    if (newStatus !== task.status) {
      const targetTasks = tasksByStatus[newStatus] ?? [];
      const limit = wipLimits[newStatus];
      if (limit !== undefined && targetTasks.length >= limit) {
        alert(`WIP limit reached: "${newStatus}" column is limited to ${limit} tasks.`);
        return;
      }
      updateStatus.mutate({ taskId, status: newStatus });
      return;
    }

    // Same column reorder
    const overId = over.id as string;
    if (taskId === overId) return;

    const columnTasks = tasksByStatus[task.status] ?? [];
    const oldIndex = columnTasks.findIndex((t) => t.id === taskId);
    const newIndex = columnTasks.findIndex((t) => t.id === overId);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(columnTasks, oldIndex, newIndex);
    // Persist each moved task's new sortIndex
    reordered.forEach((t, idx) => {
      if (t.sortIndex !== idx) {
        updatePriority.mutate({ taskId: t.id, sortIndex: idx });
      }
    });
  }

  return (
    <div className="space-y-4" data-testid="kanban-board">
      <TaskFiltersToolbar filters={filters} onFiltersChange={setFilters} />

      {hasActiveFilters && (
        <p className="text-xs text-muted-foreground" data-testid="kanban-filter-count">
          Showing {filteredTasks.length} of {tasks?.length ?? 0} tasks
        </p>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TASK_STATUSES.map((status) => (
            <KanbanColumn key={status} status={status} tasks={tasksByStatus[status] ?? []} subtaskCounts={subtaskCounts} wipLimit={wipLimits[status]} />
          ))}
        </div>
        <DragOverlay>{activeTask ? <TaskCard task={activeTask} isDragging subtaskProgress={subtaskCounts.get(activeTask.id)} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
