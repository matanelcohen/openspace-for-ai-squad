import type { Decision } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
  },
}));

import { api } from '@/lib/api-client';

import { useDecisions } from '../use-decisions';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const TestWrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  TestWrapper.displayName = 'DecisionsQueryWrapper';

  return TestWrapper;
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
    vi.mocked(api.get).mockResolvedValue(mockDecisions);

    const { result } = renderHook(() => useDecisions(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDecisions);
    expect(api.get).toHaveBeenCalledWith('/api/decisions');
  });

  it('handles errors', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useDecisions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });

  it('returns empty array when no decisions', async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    const { result } = renderHook(() => useDecisions(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual([]);
  });
});
