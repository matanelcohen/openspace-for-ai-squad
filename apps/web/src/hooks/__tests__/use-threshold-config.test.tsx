import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

import { api } from '@/lib/api-client';

import { useThresholdConfig, useUpdateChains, useUpdateThresholds } from '../use-threshold-config';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'ThresholdWrapper';
  return { wrapper: Wrapper, queryClient };
};

const mockConfig = {
  thresholds: [
    { threshold: 0.5, escalationLevel: 1 },
    { threshold: 0.8, escalationLevel: 2 },
  ],
  chains: [
    { id: 'c1', name: 'Default Chain', levels: [] },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe('useThresholdConfig', () => {
  it('fetches /api/escalations/config', async () => {
    vi.mocked(api.get).mockResolvedValue(mockConfig);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useThresholdConfig(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/api/escalations/config');
    expect(result.current.data).toEqual(mockConfig);
  });
});

describe('useUpdateThresholds', () => {
  it('puts thresholds to correct URL', async () => {
    vi.mocked(api.put).mockResolvedValue(mockConfig);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateThresholds(), { wrapper });

    const thresholds = [{ threshold: 0.9, escalationLevel: 3 }];
    await act(async () => {
      await result.current.mutateAsync(thresholds as any);
    });

    expect(api.put).toHaveBeenCalledWith('/api/escalations/config/thresholds', {
      thresholds,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['escalation-config'] });
  });
});

describe('useUpdateChains', () => {
  it('puts chains to correct URL', async () => {
    vi.mocked(api.put).mockResolvedValue(mockConfig);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateChains(), { wrapper });

    const chains = [{ id: 'c1', name: 'Custom', levels: [] }];
    await act(async () => {
      await result.current.mutateAsync(chains as any);
    });

    expect(api.put).toHaveBeenCalledWith('/api/escalations/config/chains', {
      chains,
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['escalation-config'] });
  });
});
