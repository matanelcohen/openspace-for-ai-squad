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

import { useDecisionSearch } from '../use-decision-search';

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

  TestWrapper.displayName = 'DecisionSearchQueryWrapper';

  return TestWrapper;
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
  });

  it('returns search results after debounce', async () => {
    vi.mocked(api.get).mockResolvedValue(mockDecisions);

    const { result } = renderHook(() => useDecisionSearch('typescript'), {
      wrapper: createWrapper(),
    });

    // Should eventually make the API call after debounce
    await waitFor(
      () => {
        expect(api.get).toHaveBeenCalledWith('/api/decisions/search?q=typescript');
      },
      { timeout: 2000 },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockDecisions);
  });

  it('does not search for empty query', async () => {
    renderHook(() => useDecisionSearch(''), {
      wrapper: createWrapper(),
    });

    // Wait a bit to ensure no API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(api.get).not.toHaveBeenCalled();
  });

  it('handles search errors', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Search failed'));

    const { result } = renderHook(() => useDecisionSearch('test'), {
      wrapper: createWrapper(),
    });

    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 2000 },
    );
  });
});
