import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('@/components/providers/websocket-provider', () => ({
  useWsEvent: vi.fn(),
}));

import { api } from '@/lib/api-client';

import {
  useCreateSandbox,
  useDestroySandbox,
  useRunCommand,
  useSandbox,
  useSandboxes,
  useStopSandbox,
} from '../use-sandboxes';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'SandboxesQueryWrapper';
  return { wrapper: Wrapper, queryClient };
};

const mockSandbox = {
  id: 'sb-1',
  name: 'my-sandbox',
  runtime: 'node',
  status: 'running',
  agentId: null,
  createdAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
  image: 'node:20-slim',
  port: 3000,
  resources: { cpuPercent: 10, memoryMb: 128, memoryLimitMb: 512 },
};

beforeEach(() => vi.clearAllMocks());

describe('useSandboxes', () => {
  it('fetches /api/sandboxes', async () => {
    vi.mocked(api.get).mockResolvedValue([mockSandbox]);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSandboxes(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/api/sandboxes');
    expect(result.current.data).toEqual([mockSandbox]);
  });
});

describe('useSandbox', () => {
  it('fetches a single sandbox by id', async () => {
    vi.mocked(api.get).mockResolvedValue(mockSandbox);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSandbox('sb-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/api/sandboxes/sb-1');
  });

  it('is disabled when id is empty', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSandbox(''), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(api.get).not.toHaveBeenCalled();
  });
});

describe('useCreateSandbox', () => {
  it('posts to /api/sandboxes', async () => {
    vi.mocked(api.post).mockResolvedValue(mockSandbox);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateSandbox(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'test', runtime: 'node' as any });
    });

    expect(api.post).toHaveBeenCalledWith('/api/sandboxes', { name: 'test', runtime: 'node' });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sandboxes'] });
  });
});

describe('useRunCommand', () => {
  it('posts command to /api/sandboxes/:id/exec', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRunCommand(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ sandboxId: 'sb-1', command: 'ls -la' });
    });

    expect(api.post).toHaveBeenCalledWith('/api/sandboxes/sb-1/exec', { command: 'ls -la' });
  });
});

describe('useStopSandbox', () => {
  it('posts to stop endpoint and invalidates', async () => {
    vi.mocked(api.post).mockResolvedValue(mockSandbox);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useStopSandbox(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('sb-1');
    });

    expect(api.post).toHaveBeenCalledWith('/api/sandboxes/sb-1/stop', {});
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sandboxes'] });
  });
});

describe('useDestroySandbox', () => {
  it('deletes sandbox and applies optimistic update', async () => {
    vi.mocked(api.delete).mockResolvedValue(undefined);

    const { wrapper, queryClient } = createWrapper();
    // Seed sandboxes in cache
    queryClient.setQueryData(['sandboxes'], [mockSandbox]);

    const { result } = renderHook(() => useDestroySandbox(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('sb-1');
    });

    expect(api.delete).toHaveBeenCalledWith('/api/sandboxes/sb-1');
  });

  it('restores cache on error', async () => {
    vi.mocked(api.delete).mockRejectedValue(new Error('fail'));

    const { wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(['sandboxes'], [mockSandbox]);

    const { result } = renderHook(() => useDestroySandbox(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync('sb-1');
      } catch {
        // expected
      }
    });

    // Cache should be restored
    const cached = queryClient.getQueryData<typeof mockSandbox[]>(['sandboxes']);
    expect(cached).toEqual([mockSandbox]);
  });
});
