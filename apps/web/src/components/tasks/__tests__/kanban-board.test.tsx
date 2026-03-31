import type { Task } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
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

const mutationStub = {
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  isPending: false,
} as unknown;

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseUpdateTaskStatus.mockReturnValue(mutationStub as ReturnType<typeof useUpdateTaskStatus>);
  mockedUseUpdateTaskPriority.mockReturnValue(
    mutationStub as ReturnType<typeof useUpdateTaskPriority>,
  );
  mockedUseApproveTask.mockReturnValue(mutationStub as ReturnType<typeof useApproveTask>);
  mockedUseRejectTask.mockReturnValue(mutationStub as ReturnType<typeof useRejectTask>);
  mockedUseAgents.mockReturnValue({
    data: [
      { id: 'fry', name: 'Fry', role: 'Frontend Dev', status: 'idle' },
      { id: 'bender', name: 'Bender', role: 'Backend Dev', status: 'idle' },
      { id: 'zoidberg', name: 'Zoidberg', role: 'Tester', status: 'idle' },
    ],
    isLoading: false,
    error: null,
  } as ReturnType<typeof useAgents>);
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

  it('filters cards by search text', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });

    const searchInput = screen.getByTestId('filter-search');
    fireEvent.change(searchInput, { target: { value: 'login' } });

    // Only task-1 matches "login"
    expect(screen.getByText('Build login page')).toBeInTheDocument();
    expect(screen.queryByText('Create API endpoints')).not.toBeInTheDocument();
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();

    // Filtered count should appear
    expect(screen.getByTestId('kanban-filter-count')).toHaveTextContent('1 of 3');
  });

  it('filters cards by label text in search', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });

    const searchInput = screen.getByTestId('filter-search');
    fireEvent.change(searchInput, { target: { value: 'backend' } });

    expect(screen.queryByText('Build login page')).not.toBeInTheDocument();
    expect(screen.getByText('Create API endpoints')).toBeInTheDocument();
    expect(screen.queryByText('Write tests')).not.toBeInTheDocument();
  });

  it('does not show filter count when no filters are active', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    expect(screen.queryByTestId('kanban-filter-count')).not.toBeInTheDocument();
  });

  it('shows all columns when search matches nothing', () => {
    mockedUseTasks.mockReturnValue({
      data: mockTasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });

    const searchInput = screen.getByTestId('filter-search');
    fireEvent.change(searchInput, { target: { value: 'zzz-no-match' } });

    // All columns should still be visible (with "Drop tasks here" placeholders)
    expect(screen.getByTestId('kanban-column-pending')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-in-progress')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-filter-count')).toHaveTextContent('0 of 3');
  });
});
