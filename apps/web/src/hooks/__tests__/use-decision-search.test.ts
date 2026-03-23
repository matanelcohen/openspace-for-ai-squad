import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDecisionSearch } from '../use-decision-search';
import type { Decision } from '@openspace/shared';

const mockApi = {
  get: vi.fn(),
};

vi.mock('@/lib/api-client', () => ({
  api: mockApi,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useDecisionSearch', () => {
  const mockDecisions: Decision[] = [
    {
      id: '1',
      title: 'TypeScript Decision',
      author: 'leela',
      date: '2024-01-01T10:00:00Z',
      rationale: 'Use TypeScript',
      status: 'active',
      affectedFiles: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounces search query', async () => {
    mockApi.get.mockResolvedValue({ data: mockDecisions });

    const { rerender } = renderHook(
      ({ query }) => useDecisionSearch(query),
      {
        wrapper: createWrapper(),
        initialProps: { query: 'test' },
      }
    );

    // Query should not be called immediately
    expect(mockApi.get).not.toHaveBeenCalled();

    // Fast forward debounce
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/api/decisions/search?q=test');
    });

    // Change query multiple times rapidly
    rerender({ query: 'test1' });
    rerender({ query: 'test2' });
    rerender({ query: 'test3' });

    // Should only call API once after final debounce
    mockApi.get.mockClear();
    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledTimes(1);
      expect(mockApi.get).toHaveBeenCalledWith('/api/decisions/search?q=test3');
    });
  });

  it('returns search results', async () => {
    mockApi.get.mockResolvedValue({ data: mockDecisions });

    const { result } = renderHook(() => useDecisionSearch('typescript'), {
      wrapper: createWrapper(),
    });

    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDecisions);
  });

  it('does not search for empty query', async () => {
    const { result } = renderHook(() => useDecisionSearch(''), {
      wrapper: createWrapper(),
    });

    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(mockApi.get).not.toHaveBeenCalled();
    });
  });

  it('respects custom debounce time', async () => {
    mockApi.get.mockResolvedValue({ data: mockDecisions });

    const { result } = renderHook(() => useDecisionSearch('test', 500), {
      wrapper: createWrapper(),
    });

    vi.advanceTimersByTime(300);
    expect(mockApi.get).not.toHaveBeenCalled();

    vi.advanceTimersByTime(200);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalled();
    });
  });

  it('handles search errors', async () => {
    mockApi.get.mockRejectedValue(new Error('Search failed'));

    const { result } = renderHook(() => useDecisionSearch('test'), {
      wrapper: createWrapper(),
    });

    vi.advanceTimersByTime(300);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
