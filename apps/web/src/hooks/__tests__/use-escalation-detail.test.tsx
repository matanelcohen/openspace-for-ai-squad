import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
  },
}));

vi.mock('@/components/providers/websocket-provider', () => ({
  useWsEvent: vi.fn(),
}));

import { api } from '@/lib/api-client';

import { useEscalationDetail } from '../use-escalation-detail';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'EscDetailWrapper';
  return { wrapper: Wrapper, queryClient };
};

beforeEach(() => vi.clearAllMocks());

describe('useEscalationDetail', () => {
  it('fetches escalation by id', async () => {
    const detail = { id: 'e1', status: 'pending', title: 'Esc 1' };
    vi.mocked(api.get).mockResolvedValue(detail);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useEscalationDetail('e1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/api/escalations/e1');
    expect(result.current.data).toEqual(detail);
  });

  it('is disabled when id is empty', async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useEscalationDetail(''), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'));
    expect(api.get).not.toHaveBeenCalled();
  });
});
