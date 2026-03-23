import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TaskFormDialog } from '@/components/tasks/task-form-dialog';

vi.mock('@/hooks/use-tasks');
vi.mock('@/hooks/use-agents');

import { useAgents } from '@/hooks/use-agents';
import { useCreateTask, useUpdateTask } from '@/hooks/use-tasks';

const mockedUseAgents = vi.mocked(useAgents);
const mockedUseCreateTask = vi.mocked(useCreateTask);
const mockedUseUpdateTask = vi.mocked(useUpdateTask);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const mockCreateMutate = vi.fn();
const mockUpdateMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseAgents.mockReturnValue({
    data: [
      { id: 'fry', name: 'Fry', role: 'Frontend', status: 'active', currentTask: null, expertise: [], voiceProfile: {} as never },
    ],
    isLoading: false,
    error: null,
  } as ReturnType<typeof useAgents>);

  mockedUseCreateTask.mockReturnValue({
    mutate: mockCreateMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useCreateTask>);

  mockedUseUpdateTask.mockReturnValue({
    mutate: mockUpdateMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateTask>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('TaskFormDialog', () => {
  it('renders create dialog with empty fields', () => {
    render(<TaskFormDialog open={true} onOpenChange={vi.fn()} />, { wrapper });
    expect(screen.getByTestId('task-form-dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Create Task' })).toBeInTheDocument();
    expect(screen.getByTestId('task-title-input')).toHaveValue('');
  });

  it('renders edit dialog with pre-filled fields', () => {
    const task = {
      id: 'task-1',
      title: 'Existing Task',
      description: 'Some description',
      status: 'backlog' as const,
      priority: 'P1' as const,
      assignee: 'fry',
      labels: ['frontend'],
      createdAt: '2026-03-23T10:00:00Z',
      updatedAt: '2026-03-23T12:00:00Z',
      sortIndex: 0,
    };

    render(<TaskFormDialog open={true} onOpenChange={vi.fn()} task={task} />, { wrapper });
    expect(screen.getByText('Edit Task')).toBeInTheDocument();
    expect(screen.getByTestId('task-title-input')).toHaveValue('Existing Task');
  });

  it('shows validation error when title is empty', async () => {
    render(<TaskFormDialog open={true} onOpenChange={vi.fn()} />, { wrapper });

    fireEvent.click(screen.getByTestId('task-submit-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('title-error')).toHaveTextContent('Title is required');
    });
    expect(mockCreateMutate).not.toHaveBeenCalled();
  });

  it('calls create mutation on submit with valid data', async () => {
    const onOpenChange = vi.fn();
    render(<TaskFormDialog open={true} onOpenChange={onOpenChange} />, { wrapper });

    fireEvent.change(screen.getByTestId('task-title-input'), { target: { value: 'New Task' } });
    fireEvent.click(screen.getByTestId('task-submit-btn'));

    await waitFor(() => {
      expect(mockCreateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Task' }),
        expect.any(Object),
      );
    });
  });

  it('calls update mutation when editing an existing task', async () => {
    const task = {
      id: 'task-1',
      title: 'Existing Task',
      description: '',
      status: 'backlog' as const,
      priority: 'P2' as const,
      assignee: null,
      labels: [],
      createdAt: '2026-03-23T10:00:00Z',
      updatedAt: '2026-03-23T12:00:00Z',
      sortIndex: 0,
    };

    render(<TaskFormDialog open={true} onOpenChange={vi.fn()} task={task} />, { wrapper });

    fireEvent.change(screen.getByTestId('task-title-input'), { target: { value: 'Updated Title' } });
    fireEvent.click(screen.getByTestId('task-submit-btn'));

    await waitFor(() => {
      expect(mockUpdateMutate).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 'task-1', title: 'Updated Title' }),
        expect.any(Object),
      );
    });
  });

  it('has description markdown preview tab', () => {
    render(<TaskFormDialog open={true} onOpenChange={vi.fn()} />, { wrapper });
    expect(screen.getByText('Write')).toBeInTheDocument();
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('has a cancel button that closes dialog', () => {
    const onOpenChange = vi.fn();
    render(<TaskFormDialog open={true} onOpenChange={onOpenChange} />, { wrapper });

    fireEvent.click(screen.getByText('Cancel'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
