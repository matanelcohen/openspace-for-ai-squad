import type { Task } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KanbanBoard } from '@/components/tasks/kanban-board';

vi.mock('@/hooks/use-tasks');
vi.mock('@/hooks/use-agents');

import { useAgents } from '@/hooks/use-agents';
import {
  useApproveTask,
  useRejectTask,
  useTasks,
  useUpdateTaskPriority,
  useUpdateTaskStatus,
} from '@/hooks/use-tasks';

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
    description: '',
    status: 'pending',
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
  mockedUseAgents.mockReturnValue({
    data: [
      {
        id: 'fry',
        name: 'Fry',
        role: 'Frontend',
        status: 'active',
        currentTask: null,
        expertise: [],
        voiceProfile: {} as never,
      },
      {
        id: 'bender',
        name: 'Bender',
        role: 'Backend',
        status: 'active',
        currentTask: null,
        expertise: [],
        voiceProfile: {} as never,
      },
    ],
    isLoading: false,
    error: null,
  } as ReturnType<typeof useAgents>);
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
  mockedUseApproveTask.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useApproveTask>);
  mockedUseRejectTask.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useRejectTask>);
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
    expect(screen.getByTestId('kanban-column-pending')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-in-progress')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-done')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-delegated')).toBeInTheDocument();
  });

  it('renders tasks in correct columns', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    // task-1 in pending
    const pendingCol = screen.getByTestId('kanban-column-pending');
    expect(pendingCol).toHaveTextContent('Build login page');

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
    // Pending should have 1, in-progress 1, done 1, others 0
    const pendingCol = screen.getByTestId('kanban-column-pending');
    expect(pendingCol).toHaveTextContent('1');
  });

  it('renders empty columns with placeholder', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    // blocked and delegated columns should be empty
    const blockedCol = screen.getByTestId('kanban-column-blocked');
    expect(blockedCol).toHaveTextContent('Drop tasks here');
  });

  it('renders the filters toolbar', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('task-filters-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('filter-search')).toBeInTheDocument();
    expect(screen.getByTestId('filter-priority')).toBeInTheDocument();
    expect(screen.getByTestId('filter-assignee')).toBeInTheDocument();
  });

  it('filters tasks by search text', async () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    const user = userEvent.setup();
    render(<KanbanBoard />, { wrapper });

    const searchInput = screen.getByTestId('filter-search');
    await user.type(searchInput, 'login');

    // Only "Build login page" should be visible
    expect(screen.getByText('Build login page')).toBeInTheDocument();
    expect(screen.queryByText('Create API endpoints')).not.toBeInTheDocument();
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();

    // Shows filter count
    expect(screen.getByTestId('kanban-filter-count')).toHaveTextContent('1 of 3 tasks');
  });

  it('does not show filter count when no filters active', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    expect(screen.queryByTestId('kanban-filter-count')).not.toBeInTheDocument();
  });
});
