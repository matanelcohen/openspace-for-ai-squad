import type { Task, TaskPriority, TaskStatus } from '@matanelcohen/openspace-shared';

export interface TaskFilters {
  status: TaskStatus | 'all';
  assignee: string | 'all';
  priority: TaskPriority | 'all';
  search: string;
}

export const DEFAULT_FILTERS: TaskFilters = {
  status: 'all',
  assignee: 'all',
  priority: 'all',
  search: '',
};

export function applyFilters(tasks: Task[], filters: TaskFilters): Task[] {
  return tasks.filter((t) => {
    if (filters.status !== 'all' && t.status !== filters.status) return false;
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

export function activeFilterCount(filters: TaskFilters): number {
  let count = 0;
  if (filters.status !== 'all') count++;
  if (filters.assignee !== 'all') count++;
  if (filters.priority !== 'all') count++;
  if (filters.search.trim() !== '') count++;
  return count;
}
