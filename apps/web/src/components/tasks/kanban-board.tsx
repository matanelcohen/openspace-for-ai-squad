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
import type { Task, TaskStatus } from '@matanelcohen/openspace-shared';
import { TASK_STATUSES } from '@matanelcohen/openspace-shared';
import { useMemo, useState } from 'react';

import { KanbanColumn } from '@/components/tasks/kanban-column';
import { TaskCard } from '@/components/tasks/task-card';
import { type TaskFilters, TaskFiltersToolbar } from '@/components/tasks/task-filters-toolbar';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasks, useUpdateTaskPriority, useUpdateTaskStatus } from '@/hooks/use-tasks';

/** Apply assignee, priority, and search filters (status is handled by column visibility). */
function applyCardFilters(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter((t) => {
    if (filters.priority !== 'all' && t.priority !== filters.priority) return false;
    if (filters.assignee !== 'all') {
      if (filters.assignee === 'unassigned' && t.assignee !== null) return false;
      if (filters.assignee !== 'unassigned' && t.assignee !== filters.assignee) return false;
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = t.description.toLowerCase().includes(q);
      const matchLabels = t.labels.some((l) => l.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchLabels) return false;
    }
    return true;
  });
}

function hasActiveFilters(filters: TaskFilters): boolean {
  return (
    filters.status !== 'all' ||
    filters.assignee !== 'all' ||
    filters.priority !== 'all' ||
    filters.search !== ''
  );
}

export function KanbanBoard() {
  const { data: tasks, isLoading, error } = useTasks();
  const updateStatus = useUpdateTaskStatus();
  const updatePriority = useUpdateTaskPriority();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({
    status: 'all',
    assignee: 'all',
    priority: 'all',
    search: '',
  });

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const visibleStatuses = useMemo(
    () =>
      filters.status === 'all' ? TASK_STATUSES : TASK_STATUSES.filter((s) => s === filters.status),
    [filters.status],
  );

  const { tasksByStatus, filteredTotal } = useMemo(() => {
    const allTasks = tasks ?? [];
    const filtered = applyCardFilters(allTasks, filters);

    const grouped = TASK_STATUSES.reduce(
      (acc, status) => {
        acc[status] = filtered
          .filter((t) => t.status === status)
          .sort((a, b) => a.sortIndex - b.sortIndex);
        return acc;
      },
      {} as Record<TaskStatus, Task[]>,
    );

    return { tasksByStatus: grouped, filteredTotal: filtered.length };
  }, [tasks, filters]);

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

  const isFiltered = hasActiveFilters(filters);

  return (
    <div className="space-y-4" data-testid="kanban-board-wrapper">
      <TaskFiltersToolbar filters={filters} onFiltersChange={setFilters} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-board">
          {visibleStatuses.map((status) => (
            <KanbanColumn key={status} status={status} tasks={tasksByStatus[status] ?? []} />
          ))}
        </div>
        <DragOverlay>{activeTask ? <TaskCard task={activeTask} isDragging /> : null}</DragOverlay>
      </DndContext>

      {isFiltered && (
        <p className="text-xs text-muted-foreground" data-testid="kanban-filter-count">
          Showing {filteredTotal} of {tasks?.length ?? 0} tasks
        </p>
      )}
    </div>
  );
}
