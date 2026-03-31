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
    description: 'Create the login form',
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
    description: 'Build REST API',
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
    description: 'Add unit tests',
    status: 'done',
    priority: 'P2',
    assignee: 'zoidberg',
    assigneeType: 'agent',
    labels: ['qa'],
    createdAt: '2026-03-23T08:00:00Z',
    updatedAt: '2026-03-23T12:00:00Z',
    sortIndex: 0,
  },
  {
    id: 'task-4',
    title: 'Fix header bug',
    description: 'Header overlaps on mobile',
    status: 'pending',
    priority: 'P0',
    assignee: null,
    assigneeType: 'agent',
    labels: ['frontend', 'bug'],
    createdAt: '2026-03-23T13:00:00Z',
    updatedAt: '2026-03-23T13:00:00Z',
    sortIndex: 1,
  },
];

function setupMocks(
  tasksData: Task[] | undefined = mockTasks,
  loading = false,
  err: Error | null = null,
) {
  mockedUseTasks.mockReturnValue({
    data: tasksData,
    isLoading: loading,
    error: err,
  } as ReturnType<typeof useTasks>);
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
  mockedUseAgents.mockReturnValue({
    data: [
      { id: 'fry', name: 'Fry', role: 'Frontend Dev', status: 'idle', personality: '', skills: [] },
      {
        id: 'bender',
        name: 'Bender',
        role: 'Backend Dev',
        status: 'idle',
        personality: '',
        skills: [],
      },
      { id: 'zoidberg', name: 'Zoidberg', role: 'QA', status: 'idle', personality: '', skills: [] },
    ],
    isLoading: false,
    error: null,
  } as ReturnType<typeof useAgents>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('KanbanBoard', () => {
  it('shows loading state while fetching', () => {
    setupMocks(undefined, true);
    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('kanban-loading')).toBeInTheDocument();
  });

  it('shows error state on failure', () => {
    setupMocks(undefined, false, new Error('Connection refused'));
    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('kanban-error')).toBeInTheDocument();
    expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
  });

  it('renders all 5 kanban columns', () => {
    setupMocks();
    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-pending')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-in-progress')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-done')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-blocked')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-delegated')).toBeInTheDocument();
  });

  it('renders tasks in correct columns', () => {
    setupMocks();
    render(<KanbanBoard />, { wrapper });
    const pendingCol = screen.getByTestId('kanban-column-pending');
    expect(pendingCol).toHaveTextContent('Build login page');

    const inProgressCol = screen.getByTestId('kanban-column-in-progress');
    expect(inProgressCol).toHaveTextContent('Create API endpoints');

    const doneCol = screen.getByTestId('kanban-column-done');
    expect(doneCol).toHaveTextContent('Write tests');
  });

  it('shows column counts', () => {
    setupMocks();
    render(<KanbanBoard />, { wrapper });
    const pendingCol = screen.getByTestId('kanban-column-pending');
    // 2 pending tasks (task-1 and task-4)
    expect(pendingCol).toHaveTextContent('2');
  });

  it('renders empty columns with placeholder', () => {
    setupMocks();
    render(<KanbanBoard />, { wrapper });
    const blockedCol = screen.getByTestId('kanban-column-blocked');
    expect(blockedCol).toHaveTextContent('Drop tasks here');
  });

  it('renders the filters toolbar', () => {
    setupMocks();
    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('task-filters-toolbar')).toBeInTheDocument();
    expect(screen.getByTestId('filter-search')).toBeInTheDocument();
    expect(screen.getByTestId('filter-priority')).toBeInTheDocument();
    expect(screen.getByTestId('filter-assignee')).toBeInTheDocument();
  });

  it('does not show filter count when no filters are active', () => {
    setupMocks();
    render(<KanbanBoard />, { wrapper });
    expect(screen.queryByTestId('kanban-filter-count')).not.toBeInTheDocument();
  });

  it('filters tasks by search text', () => {
    setupMocks();
    render(<KanbanBoard />, { wrapper });

    const searchInput = screen.getByTestId('filter-search');
    fireEvent.change(searchInput, { target: { value: 'login' } });

    // Only task-1 matches "login"
    expect(screen.getByTestId('kanban-filter-count')).toHaveTextContent('1 of 4');
    const pendingCol = screen.getByTestId('kanban-column-pending');
    expect(pendingCol).toHaveTextContent('Build login page');
    expect(pendingCol).not.toHaveTextContent('Fix header bug');
  });

  it('filters tasks by priority', () => {
    setupMocks();
    render(<KanbanBoard />, { wrapper });

    // task-2 (P0, in-progress) and task-4 (P0, pending) should match
    const searchInput = screen.getByTestId('filter-search');
    fireEvent.change(searchInput, { target: { value: 'API' } });

    expect(screen.getByTestId('kanban-filter-count')).toHaveTextContent('1 of 4');
    const inProgressCol = screen.getByTestId('kanban-column-in-progress');
    expect(inProgressCol).toHaveTextContent('Create API endpoints');
  });

  it('filters by label text via search', () => {
    setupMocks();
    render(<KanbanBoard />, { wrapper });

    const searchInput = screen.getByTestId('filter-search');
    fireEvent.change(searchInput, { target: { value: 'bug' } });

    // task-4 has label "bug"
    expect(screen.getByTestId('kanban-filter-count')).toHaveTextContent('1 of 4');
    const pendingCol = screen.getByTestId('kanban-column-pending');
    expect(pendingCol).toHaveTextContent('Fix header bug');
  });

  it('shows empty columns when all tasks are filtered out', () => {
    setupMocks();
    render(<KanbanBoard />, { wrapper });

    const searchInput = screen.getByTestId('filter-search');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    expect(screen.getByTestId('kanban-filter-count')).toHaveTextContent('0 of 4');
    // All columns should show "Drop tasks here"
    expect(screen.getByTestId('kanban-column-pending')).toHaveTextContent('Drop tasks here');
    expect(screen.getByTestId('kanban-column-in-progress')).toHaveTextContent('Drop tasks here');
    expect(screen.getByTestId('kanban-column-done')).toHaveTextContent('Drop tasks here');
  });
});
