'use client';

import type { TaskPriority, TaskStatus } from '@matanelcohen/openspace-shared';
import { TASK_PRIORITIES, TASK_STATUSES } from '@matanelcohen/openspace-shared';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import type { TaskFilters } from '@/components/tasks/task-filters-toolbar';

const PARAM_STATUS = 'status';
const PARAM_PRIORITY = 'priority';
const PARAM_ASSIGNEE = 'assignee';
const PARAM_SEARCH = 'search';

const DEFAULT_FILTERS: TaskFilters = {
  status: 'all',
  assignee: 'all',
  priority: 'all',
  search: '',
};

function isValidStatus(value: string | null): value is TaskStatus {
  return value !== null && (TASK_STATUSES as readonly string[]).includes(value);
}

function isValidPriority(value: string | null): value is TaskPriority {
  return value !== null && (TASK_PRIORITIES as readonly string[]).includes(value);
}

/**
 * Syncs TaskFilters with URL search params so filters survive refresh and are shareable.
 */
export function useTaskFilterParams(): [TaskFilters, (filters: TaskFilters) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const filters: TaskFilters = useMemo(() => {
    const statusParam = searchParams.get(PARAM_STATUS);
    const priorityParam = searchParams.get(PARAM_PRIORITY);
    const assigneeParam = searchParams.get(PARAM_ASSIGNEE);
    const searchParam = searchParams.get(PARAM_SEARCH);

    return {
      status: isValidStatus(statusParam) ? statusParam : DEFAULT_FILTERS.status,
      priority: isValidPriority(priorityParam) ? priorityParam : DEFAULT_FILTERS.priority,
      assignee: assigneeParam ?? DEFAULT_FILTERS.assignee,
      search: searchParam ?? DEFAULT_FILTERS.search,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (next: TaskFilters) => {
      const params = new URLSearchParams(searchParams.toString());

      // Only set non-default values; remove defaults to keep URL clean
      if (next.status !== 'all') {
        params.set(PARAM_STATUS, next.status);
      } else {
        params.delete(PARAM_STATUS);
      }

      if (next.priority !== 'all') {
        params.set(PARAM_PRIORITY, next.priority);
      } else {
        params.delete(PARAM_PRIORITY);
      }

      if (next.assignee !== 'all') {
        params.set(PARAM_ASSIGNEE, next.assignee);
      } else {
        params.delete(PARAM_ASSIGNEE);
      }

      if (next.search) {
        params.set(PARAM_SEARCH, next.search);
      } else {
        params.delete(PARAM_SEARCH);
      }

      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  return [filters, setFilters];
}
