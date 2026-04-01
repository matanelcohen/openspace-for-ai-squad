'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@matanelcohen/openspace-shared';

import { TaskCard } from '@/components/tasks/task-card';

interface SortableTaskCardProps {
  task: Task;
  subtaskProgress?: { total: number; done: number };
  isSelected?: boolean;
  onToggleSelect?: (taskId: string) => void;
}

export function SortableTaskCard({ task, subtaskProgress, isSelected, onToggleSelect }: SortableTaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TaskCard task={task} isDragging={isDragging} subtaskProgress={subtaskProgress} isSelected={isSelected} onToggleSelect={onToggleSelect} />
    </div>
  );
}
