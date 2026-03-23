import type { Task } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KanbanBoard } from '@/components/tasks/kanban-board';

vi.mock('@/hooks/use-tasks');

import { useTasks, useUpdateTaskPriority, useUpdateTaskStatus } from '@/hooks/use-tasks';

const mockedUseTasks = vi.mocked(useTasks);
const mockedUseUpdateTaskStatus = vi.mocked(useUpdateTaskStatus);
const mockedUseUpdateTaskPriority = vi.mocked(useUpdateTaskPriority);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Build login page',
    description: '',
    status: 'backlog',
    priority: 'P1',
    assignee: 'fry',
    labels: ['frontend'],
    createdAt: '2026-03-23T10:00:00Z',
    updatedAt: '2026-03-23T10:00:00Z',
    sortIndex: 0,
  },
  {
    id: 'task-2',
    title: 'Create API endpoints',
    description: '',
    status: 'in-progress',
    priority: 'P0',
    assignee: 'bender',
    labels: ['backend'],
    createdAt: '2026-03-23T09:00:00Z',
    updatedAt: '2026-03-23T11:00:00Z',
    sortIndex: 0,
  },
  {
    id: 'task-3',
    title: 'Write tests',
    description: '',
    status: 'done',
    priority: 'P2',
    assignee: 'zoidberg',
    labels: ['qa'],
    createdAt: '2026-03-23T08:00:00Z',
    updatedAt: '2026-03-23T12:00:00Z',
    sortIndex: 0,
  },
];

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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('KanbanBoard', () => {
  it('shows loading state while fetching', () => {
    mockedUseTasks.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('kanban-loading')).toBeInTheDocument();
  });

  it('shows error state on failure', () => {
    mockedUseTasks.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Connection refused'),
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('kanban-error')).toBeInTheDocument();
    expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
  });

  it('renders all 5 kanban columns', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-backlog')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-in-progress')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-in-review')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-done')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-blocked')).toBeInTheDocument();
  });

  it('renders tasks in correct columns', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    // task-1 in backlog
    const backlogCol = screen.getByTestId('kanban-column-backlog');
    expect(backlogCol).toHaveTextContent('Build login page');

    // task-2 in in-progress
    const inProgressCol = screen.getByTestId('kanban-column-in-progress');
    expect(inProgressCol).toHaveTextContent('Create API endpoints');

    // task-3 in done
    const doneCol = screen.getByTestId('kanban-column-done');
    expect(doneCol).toHaveTextContent('Write tests');
  });

  it('shows column counts', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    // Backlog should have 1, in-progress 1, done 1, others 0
    const backlogCol = screen.getByTestId('kanban-column-backlog');
    expect(backlogCol).toHaveTextContent('1');
  });

  it('renders empty columns with placeholder', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    // in-review and blocked columns should be empty
    const reviewCol = screen.getByTestId('kanban-column-in-review');
    expect(reviewCol).toHaveTextContent('Drop tasks here');
  });
});
