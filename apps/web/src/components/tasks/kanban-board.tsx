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
import type { TaskStatus } from '@openspace/shared';
import { TASK_STATUSES } from '@openspace/shared';
import { useState } from 'react';

import { KanbanColumn } from '@/components/tasks/kanban-column';
import { TaskCard } from '@/components/tasks/task-card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTasks, useUpdateTaskPriority, useUpdateTaskStatus } from '@/hooks/use-tasks';

export function KanbanBoard() {
  const { data: tasks, isLoading, error } = useTasks();
  const updateStatus = useUpdateTaskStatus();
  const updatePriority = useUpdateTaskPriority();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

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
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4" data-testid="kanban-error">
        <p className="text-sm text-destructive">
          Failed to load tasks: {error.message}
        </p>
      </div>
    );
  }

  const tasksByStatus = TASK_STATUSES.reduce(
    (acc, status) => {
      acc[status] = (tasks ?? [])
        .filter((t) => t.status === status)
        .sort((a, b) => a.sortIndex - b.sortIndex);
      return acc;
    },
    {} as Record<TaskStatus, typeof tasks>,
  );

  const activeTask = activeTaskId
    ? tasks?.find((t) => t.id === activeTaskId)
    : null;

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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4" data-testid="kanban-board">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status] ?? []}
          />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
