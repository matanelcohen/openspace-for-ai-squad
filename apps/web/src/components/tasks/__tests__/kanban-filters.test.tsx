import type { Task } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-tasks');
vi.mock('@/hooks/use-agents');

import { KanbanBoard } from '@/components/tasks/kanban-board';
import { useAgents } from '@/hooks/use-agents';
import {
  useApproveTask,
  useRejectTask,
  useTasks,
  useUpdateTaskPriority,
  useUpdateTaskStatus,
} from '@/hooks/use-tasks';
import type { TaskFilters } from '@/lib/task-filters';

const mockedUseTasks = vi.mocked(useTasks);
const mockedUseUpdateTaskStatus = vi.mocked(useUpdateTaskStatus);
const mockedUseUpdateTaskPriority = vi.mocked(useUpdateTaskPriority);
const mockedUseAgents = vi.mocked(useAgents);
const mockedUseApproveTask = vi.mocked(useApproveTask);
const mockedUseRejectTask = vi.mocked(useRejectTask);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Build login page',
    description: 'Create the login form for auth',
    status: 'pending',
    priority: 'P1',
    assignee: 'fry',
    assigneeType: 'agent',
    labels: ['frontend'],
    createdAt: '2026-03-23T10:00:00Z',
    updatedAt: '2026-03-23T10:00:00Z',
    sortIndex: 0,
  },
  {
    id: 'task-2',
    title: 'Create API endpoints',
    description: 'REST endpoints for tasks',
    status: 'in-progress',
    priority: 'P0',
    assignee: 'bender',
    assigneeType: 'agent',
    labels: ['backend'],
    createdAt: '2026-03-23T09:00:00Z',
    updatedAt: '2026-03-23T11:00:00Z',
    sortIndex: 0,
  },
  {
    id: 'task-3',
    title: 'Write tests',
    description: 'Add test coverage',
    status: 'done',
    priority: 'P2',
    assignee: null,
    assigneeType: 'agent',
    labels: ['qa'],
    createdAt: '2026-03-23T08:00:00Z',
    updatedAt: '2026-03-23T12:00:00Z',
    sortIndex: 0,
  },
  {
    id: 'task-4',
    title: 'Fix auth bug',
    description: 'Token refresh broken',
    status: 'in-progress',
    priority: 'P0',
    assignee: 'fry',
    assigneeType: 'agent',
    labels: ['frontend', 'bug'],
    createdAt: '2026-03-23T07:00:00Z',
    updatedAt: '2026-03-23T13:00:00Z',
    sortIndex: 1,
  },
];

const allFilters: TaskFilters = {
  status: 'all',
  assignee: 'all',
  priority: 'all',
  search: '',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseUpdateTaskStatus.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateTaskStatus>);
  mockedUseUpdateTaskPriority.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateTaskPriority>);
  mockedUseAgents.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  } as ReturnType<typeof useAgents>);
  mockedUseApproveTask.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useApproveTask>);
  mockedUseRejectTask.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useRejectTask>);
  mockedUseTasks.mockReturnValue({
    data: mockTasks,
    isLoading: false,
    error: null,
  } as ReturnType<typeof useTasks>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('KanbanBoard filters', () => {
  it('renders all columns when no filters are set', () => {
    render(<KanbanBoard filters={allFilters} />, { wrapper });
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-pending')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-in-progress')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-done')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-delegated')).toBeInTheDocument();
  });

  it('shows only the filtered status column', () => {
    const filters: TaskFilters = { ...allFilters, status: 'in-progress' };
    render(<KanbanBoard filters={filters} />, { wrapper });
    expect(screen.getByTestId('kanban-column-in-progress')).toBeInTheDocument();
    expect(screen.queryByTestId('kanban-column-pending')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kanban-column-done')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kanban-column-blocked')).not.toBeInTheDocument();
    expect(screen.queryByTestId('kanban-column-delegated')).not.toBeInTheDocument();
  });

  it('filters tasks by assignee across all columns', () => {
    const filters: TaskFilters = { ...allFilters, assignee: 'fry' };
    render(<KanbanBoard filters={filters} />, { wrapper });

    // pending column should have task-1 (fry)
    const pendingCol = screen.getByTestId('kanban-column-pending');
    expect(pendingCol).toHaveTextContent('Build login page');

    // in-progress column should have task-4 (fry) but not task-2 (bender)
    const inProgressCol = screen.getByTestId('kanban-column-in-progress');
    expect(inProgressCol).toHaveTextContent('Fix auth bug');
    expect(inProgressCol).not.toHaveTextContent('Create API endpoints');

    // done column should be empty (task-3 is unassigned)
    const doneCol = screen.getByTestId('kanban-column-done');
    expect(doneCol).toHaveTextContent('Drop tasks here');
  });

  it('filters tasks by priority', () => {
    const filters: TaskFilters = { ...allFilters, priority: 'P0' };
    render(<KanbanBoard filters={filters} />, { wrapper });

    // Only P0 tasks visible: task-2 and task-4
    const inProgressCol = screen.getByTestId('kanban-column-in-progress');
    expect(inProgressCol).toHaveTextContent('Create API endpoints');
    expect(inProgressCol).toHaveTextContent('Fix auth bug');

    // task-1 is P1, should not appear
    const pendingCol = screen.getByTestId('kanban-column-pending');
    expect(pendingCol).not.toHaveTextContent('Build login page');
  });

  it('filters tasks by search text (title)', () => {
    const filters: TaskFilters = { ...allFilters, search: 'auth' };
    render(<KanbanBoard filters={filters} />, { wrapper });

    // task-1 has "login" in title and "auth" in description → match
    const pendingCol = screen.getByTestId('kanban-column-pending');
    expect(pendingCol).toHaveTextContent('Build login page');

    // task-4 has "auth" in title → match
    const inProgressCol = screen.getByTestId('kanban-column-in-progress');
    expect(inProgressCol).toHaveTextContent('Fix auth bug');
    // task-2 doesn't match "auth"
    expect(inProgressCol).not.toHaveTextContent('Create API endpoints');
  });

  it('filters tasks by search text (labels)', () => {
    const filters: TaskFilters = { ...allFilters, search: 'bug' };
    render(<KanbanBoard filters={filters} />, { wrapper });

    // Only task-4 has 'bug' label
    const inProgressCol = screen.getByTestId('kanban-column-in-progress');
    expect(inProgressCol).toHaveTextContent('Fix auth bug');
    expect(inProgressCol).not.toHaveTextContent('Create API endpoints');
  });

  it('filters unassigned tasks', () => {
    const filters: TaskFilters = { ...allFilters, assignee: 'unassigned' };
    render(<KanbanBoard filters={filters} />, { wrapper });

    // Only task-3 (unassigned) should appear
    const doneCol = screen.getByTestId('kanban-column-done');
    expect(doneCol).toHaveTextContent('Write tests');

    // Other tasks are assigned, should not appear
    const pendingCol = screen.getByTestId('kanban-column-pending');
    expect(pendingCol).not.toHaveTextContent('Build login page');
  });

  it('combines multiple filters', () => {
    const filters: TaskFilters = {
      status: 'in-progress',
      assignee: 'fry',
      priority: 'all',
      search: '',
    };
    render(<KanbanBoard filters={filters} />, { wrapper });

    // Only in-progress column visible
    expect(screen.getByTestId('kanban-column-in-progress')).toBeInTheDocument();
    expect(screen.queryByTestId('kanban-column-pending')).not.toBeInTheDocument();

    // Only fry's task in in-progress: task-4
    const col = screen.getByTestId('kanban-column-in-progress');
    expect(col).toHaveTextContent('Fix auth bug');
    expect(col).not.toHaveTextContent('Create API endpoints');
  });

  it('shows filter count when filters are active', () => {
    const filters: TaskFilters = { ...allFilters, assignee: 'fry' };
    render(<KanbanBoard filters={filters} />, { wrapper });
    const count = screen.getByTestId('kanban-filter-count');
    expect(count).toHaveTextContent('Showing 2 of 4 tasks');
  });

  it('does not show filter count when no filters active', () => {
    render(<KanbanBoard filters={allFilters} />, { wrapper });
    expect(screen.queryByTestId('kanban-filter-count')).not.toBeInTheDocument();
  });

  it('works without filters prop (defaults to showing all)', () => {
    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-pending')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-in-progress')).toBeInTheDocument();
  });
});
