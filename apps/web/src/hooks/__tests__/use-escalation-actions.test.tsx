import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  api: {
    post: vi.fn(),
  },
}));

import { api } from '@/lib/api-client';

import {
  useApproveEscalation,
  useBulkApproveEscalations,
  useBulkRejectEscalations,
  useClaimEscalation,
  useRejectEscalation,
  useRequestChangesEscalation,
} from '../use-escalation-actions';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'EscActionWrapper';
  return { wrapper: Wrapper, queryClient };
};

beforeEach(() => vi.clearAllMocks());

describe('useClaimEscalation', () => {
  it('posts to /api/escalations/:id/claim', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'e1', status: 'claimed' });

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useClaimEscalation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('e1');
    });

    expect(api.post).toHaveBeenCalledWith('/api/escalations/e1/claim', {});
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['escalations'] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['escalation', 'e1'] });
  });
});

describe('useApproveEscalation', () => {
  it('posts with comment', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'e1', status: 'approved' });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useApproveEscalation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'e1', comment: 'LGTM' });
    });

    expect(api.post).toHaveBeenCalledWith('/api/escalations/e1/approve', { comment: 'LGTM' });
  });
});

describe('useRejectEscalation', () => {
  it('posts reject with comment', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'e2', status: 'rejected' });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRejectEscalation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'e2', comment: 'Needs work' });
    });

    expect(api.post).toHaveBeenCalledWith('/api/escalations/e2/reject', { comment: 'Needs work' });
  });
});

describe('useRequestChangesEscalation', () => {
  it('posts request-changes', async () => {
    vi.mocked(api.post).mockResolvedValue({ id: 'e3' });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRequestChangesEscalation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 'e3', comment: 'Fix this' });
    });

    expect(api.post).toHaveBeenCalledWith('/api/escalations/e3/request-changes', {
      comment: 'Fix this',
    });
  });
});

describe('useBulkApproveEscalations', () => {
  it('posts bulk approve', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useBulkApproveEscalations(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ ids: ['e1', 'e2'], comment: 'All good' });
    });

    expect(api.post).toHaveBeenCalledWith('/api/escalations/bulk/approve', {
      ids: ['e1', 'e2'],
      comment: 'All good',
    });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['escalations'] });
  });
});

describe('useBulkRejectEscalations', () => {
  it('posts bulk reject', async () => {
    vi.mocked(api.post).mockResolvedValue(undefined);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useBulkRejectEscalations(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ ids: ['e1'], comment: 'Nope' });
    });

    expect(api.post).toHaveBeenCalledWith('/api/escalations/bulk/reject', {
      ids: ['e1'],
      comment: 'Nope',
    });
  });
});
