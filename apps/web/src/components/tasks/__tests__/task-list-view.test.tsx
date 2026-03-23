import type { Task } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskListView } from '@/components/tasks/task-list-view';

vi.mock('@/hooks/use-tasks');
vi.mock('@/hooks/use-agents');

import { useAgents } from '@/hooks/use-agents';
import { useTasks } from '@/hooks/use-tasks';

const mockedUseTasks = vi.mocked(useTasks);
const mockedUseAgents = vi.mocked(useAgents);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Build login page',
    description: 'Create the login form',
    status: 'backlog',
    priority: 'P1',
    assignee: 'fry',
    labels: ['frontend'],
    createdAt: '2026-03-23T10:00:00Z',
    updatedAt: '2026-03-23T12:00:00Z',
    sortIndex: 0,
  },
  {
    id: 'task-2',
    title: 'Create API endpoints',
    description: 'REST endpoints for tasks',
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
    assignee: null,
    labels: [],
    createdAt: '2026-03-23T08:00:00Z',
    updatedAt: '2026-03-23T13:00:00Z',
    sortIndex: 0,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAgents.mockReturnValue({
    data: [
      { id: 'fry', name: 'Fry', role: 'Frontend', status: 'active', currentTask: null, expertise: [], voiceProfile: {} as never },
      { id: 'bender', name: 'Bender', role: 'Backend', status: 'active', currentTask: null, expertise: [], voiceProfile: {} as never },
    ],
    isLoading: false,
    error: null,
  } as ReturnType<typeof useAgents>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TaskListView', () => {
  it('shows loading state', () => {
    mockedUseTasks.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<TaskListView />, { wrapper });
    expect(screen.getByTestId('list-loading')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockedUseTasks.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network failure'),
    } as ReturnType<typeof useTasks>);

    render(<TaskListView />, { wrapper });
    expect(screen.getByTestId('list-error')).toBeInTheDocument();
    expect(screen.getByText(/Network failure/)).toBeInTheDocument();
  });

  it('renders all tasks in rows', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<TaskListView />, { wrapper });
    expect(screen.getByTestId('task-list-view')).toBeInTheDocument();
    expect(screen.getByTestId('list-row-task-1')).toBeInTheDocument();
    expect(screen.getByTestId('list-row-task-2')).toBeInTheDocument();
    expect(screen.getByTestId('list-row-task-3')).toBeInTheDocument();
  });

  it('shows task count', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<TaskListView />, { wrapper });
    expect(screen.getByTestId('list-count')).toHaveTextContent('3 of 3 tasks');
  });

  it('shows "Unassigned" for tasks without assignee', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<TaskListView />, { wrapper });
    const row = screen.getByTestId('list-row-task-3');
    expect(within(row).getByText('Unassigned')).toBeInTheDocument();
  });

  it('renders task links to detail page', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<TaskListView />, { wrapper });
    const link = screen.getByTestId('task-link-task-1');
    expect(link).toHaveAttribute('href', '/tasks/task-1');
  });

  it('renders filters toolbar', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<TaskListView />, { wrapper });
    expect(screen.getByTestId('task-filters-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('filter-search')).toBeInTheDocument();
  });

  it('shows empty state when no tasks match filters', () => {
    mockedUseTasks.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<TaskListView />, { wrapper });
    expect(screen.getByText('No tasks match your filters.')).toBeInTheDocument();
  });
});
