/**
 * P2-10 — Comprehensive frontend component tests: hooks
 *
 * Tests useAgents, useSquad, useTasks, useUpdateTaskStatus, useCreateTask,
 * useUpdateTask, useUpdateTaskPriority hooks.
 */
import type { Agent, SquadOverview, Task } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgents } from '@/hooks/use-agents';
import { useSquad } from '@/hooks/use-squad';
import {
  useCreateTask,
  useTasks,
  useUpdateTask,
  useUpdateTaskPriority,
  useUpdateTaskStatus,
} from '@/hooks/use-tasks';

// ── Fetch mock ────────────────────────────────────────────────────

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// ── Wrapper ───────────────────────────────────────────────────────

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// ── Fixtures ──────────────────────────────────────────────────────

const mockAgents: Agent[] = [
  {
    id: 'leela',
    name: 'Leela',
    role: 'Lead',
    status: 'active',
    currentTask: 'Planning',
    expertise: ['Architecture'],
    voiceProfile: { agentId: 'leela', displayName: 'Leela', voiceId: 'v1', personality: 'Confident' },
  },
];

const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Auth module',
    description: 'Build JWT auth',
    status: 'backlog',
    priority: 'P1',
    assignee: 'bender',
    labels: ['backend'],
    createdAt: '2026-03-23T10:00:00Z',
    updatedAt: '2026-03-23T10:00:00Z',
    sortIndex: 0,
  },
  {
    id: 'task-2',
    title: 'UI polish',
    description: '',
    status: 'in-progress',
    priority: 'P2',
    assignee: null,
    labels: [],
    createdAt: '2026-03-23T11:00:00Z',
    updatedAt: '2026-03-23T11:00:00Z',
    sortIndex: 1,
  },
];

const mockSquad: SquadOverview = {
  config: { id: 'default', name: 'test', description: '', squadDir: '/tmp', agents: mockAgents },
  agents: mockAgents,
  recentTasks: [],
  taskCounts: {
    byStatus: { backlog: 1, 'in-progress': 1, 'in-review': 0, done: 0, blocked: 0 },
    total: 2,
  },
  recentDecisions: [],
};

// ── Setup/Teardown ────────────────────────────────────────────────

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  fetchMock.mockReset();
});

afterEach(() => {
  queryClient.clear();
});

// ── useAgents ─────────────────────────────────────────────────────

describe('useAgents', () => {
  it('fetches agents from /api/agents', async () => {
    fetchMock.mockReturnValue(jsonResponse(mockAgents));
    const { result } = renderHook(() => useAgents(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockAgents);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/agents'),
      expect.anything(),
    );
  });

  it('returns error on fetch failure', async () => {
    fetchMock.mockReturnValue(jsonResponse({ error: 'fail' }, 500));
    const { result } = renderHook(() => useAgents(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

// ── useSquad ──────────────────────────────────────────────────────

describe('useSquad', () => {
  it('fetches squad overview from /api/squad', async () => {
    fetchMock.mockReturnValue(jsonResponse(mockSquad));
    const { result } = renderHook(() => useSquad(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockSquad);
  });
});

// ── useTasks ──────────────────────────────────────────────────────

describe('useTasks', () => {
  it('fetches tasks from /api/tasks', async () => {
    fetchMock.mockReturnValue(jsonResponse(mockTasks));
    const { result } = renderHook(() => useTasks(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
  });

  it('returns loading state initially', () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useTasks(), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });
});

// ── useUpdateTaskStatus (mutation contract) ───────────────────────

describe('useUpdateTaskStatus', () => {
  it('calls PATCH /api/tasks/:id/status', async () => {
    // Pre-seed the tasks cache so the optimistic updater has data
    queryClient.setQueryData<Task[]>(['tasks'], mockTasks);

    const updatedTask = { ...mockTasks[0]!, status: 'done' as const };
    fetchMock.mockResolvedValue(jsonResponse(updatedTask));

    const { result } = renderHook(() => useUpdateTaskStatus(), { wrapper });
    result.current.mutate({ taskId: 'task-1', status: 'done' });

    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

    // Verify the right endpoint was called
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/task-1/status'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('reports error on mutation failure', async () => {
    queryClient.setQueryData<Task[]>(['tasks'], mockTasks);
    fetchMock.mockResolvedValue(jsonResponse({ error: 'fail' }, 500));

    const { result } = renderHook(() => useUpdateTaskStatus(), { wrapper });
    result.current.mutate({ taskId: 'task-1', status: 'done' });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

// ── useCreateTask ─────────────────────────────────────────────────

describe('useCreateTask', () => {
  it('calls POST /api/tasks', async () => {
    queryClient.setQueryData<Task[]>(['tasks'], mockTasks);

    const newTask: Task = {
      id: 'task-new',
      title: 'New task',
      description: 'Desc',
      status: 'backlog',
      priority: 'P0',
      assignee: null,
      labels: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      sortIndex: 0,
    };
    fetchMock.mockResolvedValue(jsonResponse(newTask));

    const { result } = renderHook(() => useCreateTask(), { wrapper });
    result.current.mutate({
      title: 'New task',
      description: 'Desc',
      assignee: null,
      priority: 'P0',
      labels: [],
    });

    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});

// ── useUpdateTask ─────────────────────────────────────────────────

describe('useUpdateTask', () => {
  it('calls PUT /api/tasks/:id', async () => {
    queryClient.setQueryData<Task[]>(['tasks'], mockTasks);

    const updated = { ...mockTasks[0]!, title: 'Updated title' };
    fetchMock.mockResolvedValue(jsonResponse(updated));

    const { result } = renderHook(() => useUpdateTask(), { wrapper });
    result.current.mutate({
      taskId: 'task-1',
      title: 'Updated title',
      description: 'Build JWT auth',
      assignee: 'bender',
      priority: 'P1',
      labels: ['backend'],
    });

    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/task-1'),
      expect.objectContaining({ method: 'PUT' }),
    );
  });
});

// ── useUpdateTaskPriority ─────────────────────────────────────────

describe('useUpdateTaskPriority', () => {
  it('calls PATCH /api/tasks/:id/priority', async () => {
    queryClient.setQueryData<Task[]>(['tasks'], mockTasks);
    fetchMock.mockResolvedValue(jsonResponse({ ...mockTasks[0]!, sortIndex: 5 }));

    const { result } = renderHook(() => useUpdateTaskPriority(), { wrapper });
    result.current.mutate({ taskId: 'task-1', sortIndex: 5 });

    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/tasks/task-1/priority'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });
});
