import type { Task } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-tasks');
vi.mock('@/hooks/use-agents');
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'task-1' }),
}));

import { useAgents } from '@/hooks/use-agents';
import { useCreateTask, useTask, useUpdateTask, useUpdateTaskStatus } from '@/hooks/use-tasks';

const mockedUseTask = vi.mocked(useTask);
const mockedUseAgents = vi.mocked(useAgents);
const mockedUseUpdateTaskStatus = vi.mocked(useUpdateTaskStatus);
const mockedUseCreateTask = vi.mocked(useCreateTask);
const mockedUseUpdateTask = vi.mocked(useUpdateTask);

// Import after mocks
import TaskDetailPage from '../../../../app/tasks/[id]/page';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const mockTask: Task = {
  id: 'task-1',
  title: 'Build the login page',
  description: '## Login Form\n\nCreate a form with email and password fields.',
  status: 'in-progress',
  priority: 'P1',
  assignee: 'fry',
  labels: ['frontend', 'auth'],
  createdAt: '2026-03-23T10:00:00Z',
  updatedAt: '2026-03-23T12:00:00Z',
  sortIndex: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAgents.mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
  } as ReturnType<typeof useAgents>);
  mockedUseUpdateTaskStatus.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateTaskStatus>);
  mockedUseCreateTask.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useCreateTask>);
  mockedUseUpdateTask.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateTask>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TaskDetailPage', () => {
  it('shows loading state', () => {
    mockedUseTask.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getByTestId('task-detail-loading')).toBeInTheDocument();
  });

  it('shows error state', () => {
    mockedUseTask.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getByTestId('task-detail-error')).toBeInTheDocument();
    expect(screen.getByText(/Not found/)).toBeInTheDocument();
  });

  it('renders task title', () => {
    mockedUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getByTestId('task-title')).toHaveTextContent('Build the login page');
  });

  it('renders task description as markdown', () => {
    mockedUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getByTestId('task-description')).toBeInTheDocument();
    // Markdown heading should render
    expect(screen.getByText('Login Form')).toBeInTheDocument();
  });

  it('shows labels', () => {
    mockedUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getByText('frontend')).toBeInTheDocument();
    expect(screen.getByText('auth')).toBeInTheDocument();
  });

  it('shows priority badge', () => {
    mockedUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getAllByText('P1 — High').length).toBeGreaterThanOrEqual(1);
  });

  it('shows timestamps', () => {
    mockedUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getByTestId('task-timestamps')).toBeInTheDocument();
  });

  it('has back to tasks link', () => {
    mockedUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getByTestId('back-to-board')).toHaveAttribute('href', '/tasks');
  });

  it('has edit button', () => {
    mockedUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getByTestId('edit-task-btn')).toBeInTheDocument();
  });

  it('has inline status selector', () => {
    mockedUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getByTestId('status-select')).toBeInTheDocument();
  });

  it('shows assignee when assigned', () => {
    mockedUseTask.mockReturnValue({
      data: mockTask,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getByText('fry')).toBeInTheDocument();
  });

  it('shows "Unassigned" when no assignee', () => {
    mockedUseTask.mockReturnValue({
      data: { ...mockTask, assignee: null },
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTask>);

    render(<TaskDetailPage />, { wrapper });
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });
});
