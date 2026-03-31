'use client';

import type { TaskPriority, TaskStatus } from '@matanelcohen/openspace-shared';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
} from '@matanelcohen/openspace-shared';
import { Search, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAgents } from '@/hooks/use-agents';
import { activeFilterCount, DEFAULT_FILTERS, type TaskFilters } from '@/lib/task-filters';

export type { TaskFilters } from '@/lib/task-filters';

interface TaskFiltersToolbarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
}

export function TaskFiltersToolbar({ filters, onFiltersChange }: TaskFiltersToolbarProps) {
  const { data: agents } = useAgents();
  const count = activeFilterCount(filters);

  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="task-filters-toolbar">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="w-56 pl-9"
          data-testid="filter-search"
        />
      </div>

      <Select
        value={filters.status}
        onValueChange={(val) => onFiltersChange({ ...filters, status: val as TaskStatus | 'all' })}
      >
        <SelectTrigger className="w-40" data-testid="filter-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {TASK_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.assignee}
        onValueChange={(val) => onFiltersChange({ ...filters, assignee: val })}
      >
        <SelectTrigger className="w-40" data-testid="filter-assignee">
          <SelectValue placeholder="Assignee" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Assignees</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {agents?.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.priority}
        onValueChange={(val) =>
          onFiltersChange({ ...filters, priority: val as TaskPriority | 'all' })
        }
      >
        <SelectTrigger className="w-40" data-testid="filter-priority">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {TASK_PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {p} — {TASK_PRIORITY_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {count > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFiltersChange({ ...DEFAULT_FILTERS })}
          className="h-9 px-2 text-muted-foreground"
          data-testid="filter-clear"
        >
          <X className="mr-1 h-3.5 w-3.5" />
          Clear ({count})
        </Button>
      )}
    </div>
  );
}
