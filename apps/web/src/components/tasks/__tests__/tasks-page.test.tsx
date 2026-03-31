import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-tasks');
vi.mock('@/hooks/use-agents');
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/tasks',
}));

import { useAgents } from '@/hooks/use-agents';
import {
  useCreateTask,
  useTasks,
  useUpdateTask,
  useUpdateTaskPriority,
  useUpdateTaskStatus,
} from '@/hooks/use-tasks';

const mockedUseTasks = vi.mocked(useTasks);
const mockedUseAgents = vi.mocked(useAgents);
const mockedUseCreateTask = vi.mocked(useCreateTask);
const mockedUseUpdateTask = vi.mocked(useUpdateTask);
const mockedUseUpdateTaskStatus = vi.mocked(useUpdateTaskStatus);
const mockedUseUpdateTaskPriority = vi.mocked(useUpdateTaskPriority);

import TasksPage from '../../../../app/tasks/page';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseTasks.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  } as ReturnType<typeof useTasks>);
  mockedUseAgents.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  } as ReturnType<typeof useAgents>);
  mockedUseCreateTask.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useCreateTask>);
  mockedUseUpdateTask.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateTask>);
  mockedUseUpdateTaskStatus.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateTaskStatus>);
  mockedUseUpdateTaskPriority.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateTaskPriority>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TasksPage', () => {
  it('renders the page header', () => {
    render(<TasksPage />, { wrapper });
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Manage and prioritize squad work.')).toBeInTheDocument();
  });

  it('shows view toggle buttons', () => {
    render(<TasksPage />, { wrapper });
    expect(screen.getByTestId('view-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('view-toggle-board')).toBeInTheDocument();
    expect(screen.getByTestId('view-toggle-list')).toBeInTheDocument();
  });

  it('shows create task button', () => {
    render(<TasksPage />, { wrapper });
    expect(screen.getByTestId('create-task-btn')).toBeInTheDocument();
    expect(screen.getByText('New Task')).toBeInTheDocument();
  });

  it('defaults to board view', () => {
    render(<TasksPage />, { wrapper });
    // Kanban board should be rendered (from mocked useTasks returning empty array)
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
  });

  it('switches to list view when list toggle is clicked', () => {
    render(<TasksPage />, { wrapper });
    fireEvent.click(screen.getByTestId('view-toggle-list'));
    expect(screen.getByTestId('task-list-view')).toBeInTheDocument();
  });
});
