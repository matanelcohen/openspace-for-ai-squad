import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/components/providers/websocket-provider', () => ({
  useWsEvent: vi.fn(),
}));

import { api } from '@/lib/api-client';

import { useEscalations, usePendingEscalationCount } from '../use-escalations';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  Wrapper.displayName = 'EscalationsQueryWrapper';
  return { wrapper: Wrapper, queryClient };
};

const mockEscalations = [
  { id: 'e1', status: 'pending', title: 'Esc 1' },
  { id: 'e2', status: 'claimed', title: 'Esc 2' },
  { id: 'e3', status: 'approved', title: 'Esc 3' },
  { id: 'e4', status: 'pending', title: 'Esc 4' },
];

beforeEach(() => vi.clearAllMocks());

describe('useEscalations', () => {
  it('fetches /api/escalations', async () => {
    vi.mocked(api.get).mockResolvedValue(mockEscalations);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useEscalations(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith('/api/escalations');
    expect(result.current.data).toEqual(mockEscalations);
  });
});

describe('usePendingEscalationCount', () => {
  it('counts pending + claimed escalations', async () => {
    vi.mocked(api.get).mockResolvedValue(mockEscalations);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePendingEscalationCount(), { wrapper });

    await waitFor(() => expect(result.current).toBe(3));
  });

  it('returns 0 when data is undefined', () => {
    vi.mocked(api.get).mockResolvedValue(undefined);

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => usePendingEscalationCount(), { wrapper });

    expect(result.current).toBe(0);
  });
});
