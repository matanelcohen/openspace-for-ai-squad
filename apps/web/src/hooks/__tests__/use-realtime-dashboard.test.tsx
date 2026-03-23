import type { Agent, Task } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act,renderHook } from '@testing-library/react';
import { beforeEach,describe, expect, it, vi } from 'vitest';

import { useRealtimeDashboard } from '@/hooks/use-realtime-dashboard';
import type { WsEnvelope } from '@/hooks/use-websocket';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  };
}

function makeEnvelope(type: string, payload: Record<string, unknown>): WsEnvelope {
  return { type, payload, timestamp: new Date().toISOString() };
}

describe('useRealtimeDashboard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns pulsing=false by default', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRealtimeDashboard(), { wrapper });
    expect(result.current.pulsing).toBe(false);
  });

  it('updates agent cache on agent:status event', () => {
    const { queryClient, wrapper } = createWrapper();
    const agents: Agent[] = [
      {
        id: 'bender',
        name: 'Bender',
        role: 'Backend',
        status: 'idle',
        currentTask: null,
        expertise: [],
        voiceProfile: { agentId: 'bender', displayName: 'Bender', voiceId: '', personality: '' },
      },
    ];
    queryClient.setQueryData(['agents'], agents);

    let capturedCb: ((e: WsEnvelope) => void) | null = null;
    const addWsListener = vi.fn((type: string, cb: (e: WsEnvelope) => void) => {
      if (type === 'agent:status') capturedCb = cb;
      return () => {};
    });

    renderHook(() => useRealtimeDashboard(addWsListener), { wrapper });

    expect(capturedCb).toBeTruthy();
    act(() => {
      capturedCb!(makeEnvelope('agent:status', { agentId: 'bender', status: 'active' }));
    });

    const updated = queryClient.getQueryData<Agent[]>(['agents']);
    expect(updated?.[0].status).toBe('active');
  });

  it('patches task cache on task:updated event', () => {
    const { queryClient, wrapper } = createWrapper();
    const tasks: Task[] = [
      {
        id: 'task-1',
        title: 'Test',
        description: '',
        status: 'backlog',
        priority: 'P2',
        assignee: null,
        labels: [],
        createdAt: '',
        updatedAt: '',
        sortIndex: 0,
      },
    ];
    queryClient.setQueryData(['tasks'], tasks);

    let capturedCb: ((e: WsEnvelope) => void) | null = null;
    const addWsListener = vi.fn((type: string, cb: (e: WsEnvelope) => void) => {
      if (type === 'task:updated') capturedCb = cb;
      return () => {};
    });

    renderHook(() => useRealtimeDashboard(addWsListener), { wrapper });

    act(() => {
      capturedCb!(makeEnvelope('task:updated', { id: 'task-1', status: 'in-progress' }));
    });

    const updated = queryClient.getQueryData<Task[]>(['tasks']);
    expect(updated?.[0].status).toBe('in-progress');
  });

  it('adds new task to cache on task:created event', () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData<Task[]>(['tasks'], []);

    let capturedCb: ((e: WsEnvelope) => void) | null = null;
    const addWsListener = vi.fn((type: string, cb: (e: WsEnvelope) => void) => {
      if (type === 'task:created') capturedCb = cb;
      return () => {};
    });

    renderHook(() => useRealtimeDashboard(addWsListener), { wrapper });

    act(() => {
      capturedCb!(
        makeEnvelope('task:created', {
          id: 'new-task',
          title: 'New',
          description: '',
          status: 'backlog',
          priority: 'P1',
          assignee: null,
          labels: [],
          createdAt: '',
          updatedAt: '',
          sortIndex: 0,
        }),
      );
    });

    const updated = queryClient.getQueryData<Task[]>(['tasks']);
    expect(updated).toHaveLength(1);
    expect(updated?.[0].id).toBe('new-task');
  });

  it('does not duplicate tasks on repeated task:created', () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData<Task[]>(['tasks'], [
      {
        id: 'existing',
        title: 'Existing',
        description: '',
        status: 'backlog',
        priority: 'P2',
        assignee: null,
        labels: [],
        createdAt: '',
        updatedAt: '',
        sortIndex: 0,
      },
    ]);

    let capturedCb: ((e: WsEnvelope) => void) | null = null;
    const addWsListener = vi.fn((type: string, cb: (e: WsEnvelope) => void) => {
      if (type === 'task:created') capturedCb = cb;
      return () => {};
    });

    renderHook(() => useRealtimeDashboard(addWsListener), { wrapper });

    act(() => {
      capturedCb!(
        makeEnvelope('task:created', {
          id: 'existing',
          title: 'Existing',
          description: '',
          status: 'backlog',
          priority: 'P2',
          assignee: null,
          labels: [],
          createdAt: '',
          updatedAt: '',
          sortIndex: 0,
        }),
      );
    });

    const updated = queryClient.getQueryData<Task[]>(['tasks']);
    expect(updated).toHaveLength(1);
  });

  it('triggers pulse animation on updates', () => {
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData<Agent[]>(['agents'], [
      {
        id: 'fry',
        name: 'Fry',
        role: 'Frontend',
        status: 'idle',
        currentTask: null,
        expertise: [],
        voiceProfile: { agentId: 'fry', displayName: 'Fry', voiceId: '', personality: '' },
      },
    ]);

    let capturedCb: ((e: WsEnvelope) => void) | null = null;
    const addWsListener = vi.fn((type: string, cb: (e: WsEnvelope) => void) => {
      if (type === 'agent:status') capturedCb = cb;
      return () => {};
    });

    const { result } = renderHook(() => useRealtimeDashboard(addWsListener), { wrapper });

    expect(result.current.pulsing).toBe(false);

    act(() => {
      capturedCb!(makeEnvelope('agent:status', { agentId: 'fry', status: 'active' }));
    });

    expect(result.current.pulsing).toBe(true);

    act(() => {
      vi.advanceTimersByTime(700);
    });

    expect(result.current.pulsing).toBe(false);
  });

  it('invalidates squad cache on decision:added', () => {
    const { queryClient, wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    let capturedCb: ((e: WsEnvelope) => void) | null = null;
    const addWsListener = vi.fn((type: string, cb: (e: WsEnvelope) => void) => {
      if (type === 'decision:added') capturedCb = cb;
      return () => {};
    });

    renderHook(() => useRealtimeDashboard(addWsListener), { wrapper });

    act(() => {
      capturedCb!(makeEnvelope('decision:added', { id: 'd1', title: 'Test decision' }));
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['squad'] });
  });

  it('cleans up listeners on unmount', () => {
    const { wrapper } = createWrapper();
    const removeFn = vi.fn();
    const addWsListener = vi.fn(() => removeFn);

    const { unmount } = renderHook(() => useRealtimeDashboard(addWsListener), {
      wrapper,
    });

    unmount();
    expect(removeFn).toHaveBeenCalled();
  });

  it('is a no-op when no addWsListener is provided', () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRealtimeDashboard(), { wrapper });
    expect(result.current.pulsing).toBe(false);
  });
});
