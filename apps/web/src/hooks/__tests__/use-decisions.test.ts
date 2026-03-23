import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useDecisions } from '../use-decisions';
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

describe('useDecisions', () => {
  const mockDecisions: Decision[] = [
    {
      id: '1',
      title: 'Decision 1',
      author: 'leela',
      date: '2024-01-01T10:00:00Z',
      rationale: 'Rationale 1',
      status: 'active',
      affectedFiles: [],
    },
    {
      id: '2',
      title: 'Decision 2',
      author: 'bender',
      date: '2024-01-02T10:00:00Z',
      rationale: 'Rationale 2',
      status: 'superseded',
      affectedFiles: [],
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches decisions successfully', async () => {
    mockApi.get.mockResolvedValue({ data: mockDecisions });

    const { result } = renderHook(() => useDecisions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDecisions);
    expect(mockApi.get).toHaveBeenCalledWith('/api/decisions');
  });

  it('handles errors', async () => {
    mockApi.get.mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useDecisions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });

  it('returns empty array when no decisions', async () => {
    mockApi.get.mockResolvedValue({ data: [] });

    const { result } = renderHook(() => useDecisions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});
