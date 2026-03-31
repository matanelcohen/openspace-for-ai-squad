'use client';

import type { Task, TaskPriority, TaskStatus } from '@matanelcohen/openspace-shared';
import { TASK_STATUS_LABELS } from '@matanelcohen/openspace-shared';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import { AgentAvatar } from '@/components/agent-avatar';
import { PriorityBadge } from '@/components/priority-badge';
import { TaskFiltersToolbar } from '@/components/tasks/task-filters-toolbar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTasks } from '@/hooks/use-tasks';
import { applyFilters, DEFAULT_FILTERS, type TaskFilters } from '@/lib/task-filters';

type SortField = 'title' | 'status' | 'assignee' | 'priority' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const priorityOrder: Record<TaskPriority, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const statusOrder: Record<TaskStatus, number> = {
  pending: 0,
  'in-progress': 1,
  done: 2,
  blocked: 3,
  delegated: 4,
};

function sortTasks(tasks: Task[], field: SortField, dir: SortDir): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'title':
        cmp = a.title.localeCompare(b.title);
        break;
      case 'status':
        cmp = statusOrder[a.status] - statusOrder[b.status];
        break;
      case 'assignee':
        cmp = (a.assignee ?? '').localeCompare(b.assignee ?? '');
        break;
      case 'priority':
        cmp = priorityOrder[a.priority] - priorityOrder[b.priority];
        break;
      case 'updatedAt':
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
    }
    return cmp;
  });
  return dir === 'desc' ? sorted.reverse() : sorted;
}

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
}) {
  if (field !== sortField)
    return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />;
  return sortDir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

interface TaskListViewProps {
  filters?: TaskFilters;
  onFiltersChange?: (filters: TaskFilters) => void;
}

export function TaskListView({
  filters: externalFilters,
  onFiltersChange: externalOnFiltersChange,
}: TaskListViewProps) {
  const { data: tasks, isLoading, error } = useTasks();
  const [internalFilters, setInternalFilters] = useState<TaskFilters>({ ...DEFAULT_FILTERS });

  const filters = externalFilters ?? internalFilters;
  const onFiltersChange = externalOnFiltersChange ?? setInternalFilters;

  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const filteredAndSorted = useMemo(() => {
    if (!tasks) return [];
    const filtered = applyFilters(tasks, filters);
    return sortTasks(filtered, sortField, sortDir);
  }, [tasks, filters, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="list-loading">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
        data-testid="list-error"
      >
        <p className="text-sm text-destructive">Failed to load tasks: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="task-list-view">
      {!externalFilters && (
        <TaskFiltersToolbar filters={filters} onFiltersChange={onFiltersChange} />
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('title')}>
                Title <SortIcon field="title" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-32"
                onClick={() => handleSort('status')}
              >
                Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-36"
                onClick={() => handleSort('assignee')}
              >
                Assignee <SortIcon field="assignee" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-36"
                onClick={() => handleSort('priority')}
              >
                Priority <SortIcon field="priority" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead className="w-40">Labels</TableHead>
              <TableHead
                className="cursor-pointer select-none w-36"
                onClick={() => handleSort('updatedAt')}
              >
                Updated <SortIcon field="updatedAt" sortField={sortField} sortDir={sortDir} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No tasks match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((task) => (
                <TableRow key={task.id} data-testid={`list-row-${task.id}`}>
                  <TableCell>
                    <Link
                      href={`/tasks/${task.id}`}
                      className="font-medium hover:underline"
                      data-testid={`task-link-${task.id}`}
                    >
                      {task.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {TASK_STATUS_LABELS[task.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {task.assignee ? (
                      <div className="flex items-center gap-2">
                        <AgentAvatar agentId={task.assignee} name={task.assignee} size="sm" />
                        <span className="text-sm capitalize">{task.assignee}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <PriorityBadge priority={task.priority} className="text-[10px] px-1.5 py-0" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {task.labels.map((l) => (
                        <Badge key={l} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {l}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(task.updatedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="list-count">
        {filteredAndSorted.length} of {tasks?.length ?? 0} tasks
      </p>
    </div>
  );
}
