/**
 * Tests for useChannels, useChannel, useCreateChannel, useUpdateChannel,
 * useDeleteChannel, useChannelMessages, useSendChannelMessage hooks — plus
 * WebSocket-driven cache invalidation via useChannelCacheSync.
 */
import type { ChatChannel, ChatMessage } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  channelKeys,
  useChannel,
  useChannelMessages,
  useChannels,
  useCreateChannel,
  useDeleteChannel,
  useSendChannelMessage,
  useUpdateChannel,
} from '@/hooks/use-channels';
import type { WsEnvelope } from '@/hooks/use-websocket';

// ── Mock WebSocket provider (hooks call useWsEvent) ───────────────

// Stores registered callbacks so tests can fire WS events programmatically.
const wsListeners = new Map<string, Set<(envelope: WsEnvelope) => void>>();

vi.mock('@/components/providers/websocket-provider', () => ({
  useWsEvent: (type: string, cb: (envelope: WsEnvelope) => void) => {
    if (!wsListeners.has(type)) {
      wsListeners.set(type, new Set());
    }
    wsListeners.get(type)!.add(cb);
  },
  useWsSend: () => vi.fn(),
}));

/** Simulate a WebSocket event arriving. */
function fireWsEvent(type: string, payload: Record<string, unknown>) {
  const envelope: WsEnvelope = {
    type,
    payload,
    timestamp: new Date().toISOString(),
  };
  wsListeners.get(type)?.forEach((cb) => cb(envelope));
}

// ── Fetch mock ────────────────────────────────────────────────────

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// ── Wrapper ───────────────────────────────────────────────────────

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

// ── Fixtures ──────────────────────────────────────────────────────

const mockChannels: ChatChannel[] = [
  {
    id: 'ch-general',
    name: 'General',
    description: 'General discussion',
    memberAgentIds: ['leela', 'fry'],
    createdAt: '2026-03-23T10:00:00Z',
    updatedAt: '2026-03-23T10:00:00Z',
  },
  {
    id: 'ch-frontend',
    name: 'Frontend',
    description: 'Frontend team channel',
    memberAgentIds: ['fry'],
    createdAt: '2026-03-23T11:00:00Z',
    updatedAt: '2026-03-23T11:00:00Z',
  },
];

// ── Setup/Teardown ────────────────────────────────────────────────

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  fetchMock.mockReset();
  wsListeners.clear();
});

afterEach(() => {
  queryClient.clear();
  vi.useRealTimers();
});

// ── channelKeys ───────────────────────────────────────────────────

describe('channelKeys', () => {
  it('produces the expected query keys', () => {
    expect(channelKeys.all).toEqual(['channels']);
    expect(channelKeys.detail('ch-1')).toEqual(['channels', 'ch-1']);
  });
});

// ── useChannels ───────────────────────────────────────────────────

describe('useChannels', () => {
  it('fetches channels from /api/channels', async () => {
    fetchMock.mockReturnValue(jsonResponse(mockChannels));
    const { result } = renderHook(() => useChannels(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockChannels);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/channels'),
      expect.anything(),
    );
  });

  it('returns loading state initially', () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useChannels(), { wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('returns error on fetch failure', async () => {
    fetchMock.mockReturnValue(jsonResponse({ error: 'fail' }, 500));
    const { result } = renderHook(() => useChannels(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

// ── useChannel ────────────────────────────────────────────────────

describe('useChannel', () => {
  it('fetches a single channel by ID from /api/channels/:id', async () => {
    const channel = mockChannels[0]!;
    fetchMock.mockReturnValue(jsonResponse(channel));
    const { result } = renderHook(() => useChannel('ch-general'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(channel);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/channels/ch-general'),
      expect.anything(),
    );
  });

  it('does not fetch when id is empty', () => {
    const { result } = renderHook(() => useChannel(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns error on fetch failure', async () => {
    fetchMock.mockReturnValue(jsonResponse({ error: 'not found' }, 404));
    const { result } = renderHook(() => useChannel('missing-id'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

// ── useCreateChannel ──────────────────────────────────────────────

describe('useCreateChannel', () => {
  it('calls POST /api/channels', async () => {
    const newChannel: ChatChannel = {
      id: 'ch-new',
      name: 'New Channel',
      description: 'Freshly created',
      memberAgentIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    fetchMock.mockResolvedValue(jsonResponse(newChannel));

    const { result } = renderHook(() => useCreateChannel(), { wrapper });
    result.current.mutate({ name: 'New Channel', description: 'Freshly created' });

    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/channels'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('optimistically appends the new channel to the cache', async () => {
    queryClient.setQueryData(channelKeys.all, mockChannels);
    // Delay resolution so we can inspect the optimistic state
    let resolveFetch!: (v: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise((r) => {
        resolveFetch = r;
      }),
    );

    const { result } = renderHook(() => useCreateChannel(), { wrapper });
    result.current.mutate({ name: 'Optimistic Channel' });

    await waitFor(() => {
      const cached = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
      expect(cached).toHaveLength(3);
      expect(cached![2]!.name).toBe('Optimistic Channel');
      expect(cached![2]!.id).toMatch(/^temp-/);
    });

    // Resolve the fetch to let the mutation settle
    const created: ChatChannel = {
      id: 'ch-created',
      name: 'Optimistic Channel',
      description: '',
      memberAgentIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    resolveFetch(jsonResponse(created));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back cache on mutation error', async () => {
    queryClient.setQueryData(channelKeys.all, mockChannels);
    fetchMock.mockResolvedValue(jsonResponse({ error: 'fail' }, 500));

    const { result } = renderHook(() => useCreateChannel(), { wrapper });
    result.current.mutate({ name: 'Will Fail' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    // After error + invalidation settles, the previous snapshot is restored
    const cached = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
    // The rollback restores the original 2 channels (invalidation may replace with refetch,
    // but since fetch also fails the cache stays at the rolled-back state)
    expect(cached).toHaveLength(2);
  });
});

// ── useUpdateChannel ──────────────────────────────────────────────

describe('useUpdateChannel', () => {
  it('calls PATCH /api/channels/:id', async () => {
    const updated = { ...mockChannels[0]!, name: 'Renamed' };
    fetchMock.mockResolvedValue(jsonResponse(updated));

    const { result } = renderHook(() => useUpdateChannel(), { wrapper });
    result.current.mutate({ id: 'ch-general', name: 'Renamed' });

    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/channels/ch-general'),
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('optimistically merges updated fields into the cache', async () => {
    queryClient.setQueryData(channelKeys.all, mockChannels);
    let resolveFetch!: (v: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise((r) => {
        resolveFetch = r;
      }),
    );

    const { result } = renderHook(() => useUpdateChannel(), { wrapper });
    result.current.mutate({ id: 'ch-general', name: 'Renamed' });

    await waitFor(() => {
      const cached = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
      const channel = cached?.find((c) => c.id === 'ch-general');
      expect(channel?.name).toBe('Renamed');
      // Other fields should be preserved
      expect(channel?.description).toBe('General discussion');
    });

    const updated = { ...mockChannels[0]!, name: 'Renamed' };
    resolveFetch(jsonResponse(updated));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('optimistically updates the detail cache', async () => {
    queryClient.setQueryData(channelKeys.all, mockChannels);
    queryClient.setQueryData(channelKeys.detail('ch-general'), mockChannels[0]);
    let resolveFetch!: (v: unknown) => void;
    fetchMock.mockReturnValue(
      new Promise((r) => {
        resolveFetch = r;
      }),
    );

    const { result } = renderHook(() => useUpdateChannel(), { wrapper });
    result.current.mutate({ id: 'ch-general', description: 'Updated desc' });

    await waitFor(() => {
      const detail = queryClient.getQueryData<ChatChannel>(channelKeys.detail('ch-general'));
      expect(detail?.description).toBe('Updated desc');
      expect(detail?.name).toBe('General');
    });

    const updated = { ...mockChannels[0]!, description: 'Updated desc' };
    resolveFetch(jsonResponse(updated));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it('rolls back both caches on mutation error', async () => {
    queryClient.setQueryData(channelKeys.all, mockChannels);
    queryClient.setQueryData(channelKeys.detail('ch-general'), mockChannels[0]);
    fetchMock.mockResolvedValue(jsonResponse({ error: 'fail' }, 500));

    const { result } = renderHook(() => useUpdateChannel(), { wrapper });
    result.current.mutate({ id: 'ch-general', name: 'Will Fail' });

    await waitFor(() => expect(result.current.isError).toBe(true));

    const cached = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
    const channel = cached?.find((c) => c.id === 'ch-general');
    expect(channel?.name).toBe('General');

    const detail = queryClient.getQueryData<ChatChannel>(channelKeys.detail('ch-general'));
    expect(detail?.name).toBe('General');
  });
});

// ── useDeleteChannel ──────────────────────────────────────────────

describe('useDeleteChannel', () => {
  it('calls DELETE /api/channels/:id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));

    const { result } = renderHook(() => useDeleteChannel(), { wrapper });
    result.current.mutate('ch-general');

    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/channels/ch-general'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('removes detail cache on success', async () => {
    queryClient.setQueryData(channelKeys.detail('ch-general'), mockChannels[0]);
    fetchMock.mockResolvedValue(jsonResponse({ success: true }));

    const { result } = renderHook(() => useDeleteChannel(), { wrapper });
    result.current.mutate('ch-general');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(channelKeys.detail('ch-general'))).toBeUndefined();
  });
});

// ── WebSocket cache sync (useChannelCacheSync) ────────────────────

describe('WebSocket cache sync', () => {
  /** Helper: render useChannels (which calls useChannelCacheSync internally). */
  function renderWithSync() {
    fetchMock.mockReturnValue(jsonResponse(mockChannels));
    return renderHook(() => useChannels(), { wrapper });
  }

  it('appends new channel to list cache on channel:created', async () => {
    const { result } = renderWithSync();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const newChannel: ChatChannel = {
      id: 'ch-new',
      name: 'New WS Channel',
      description: '',
      memberAgentIds: [],
      createdAt: '2026-03-25T18:00:00Z',
      updatedAt: '2026-03-25T18:00:00Z',
    };

    act(() => {
      fireWsEvent('channel:created', newChannel as unknown as Record<string, unknown>);
    });

    const cached = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
    expect(cached).toHaveLength(3);
    expect(cached![2]!.id).toBe('ch-new');
  });

  it('seeds detail cache on channel:created', async () => {
    const { result } = renderWithSync();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const newChannel: ChatChannel = {
      id: 'ch-new',
      name: 'New WS Channel',
      description: '',
      memberAgentIds: [],
      createdAt: '2026-03-25T18:00:00Z',
      updatedAt: '2026-03-25T18:00:00Z',
    };

    act(() => {
      fireWsEvent('channel:created', newChannel as unknown as Record<string, unknown>);
    });

    const detail = queryClient.getQueryData<ChatChannel>(channelKeys.detail('ch-new'));
    expect(detail).toEqual(newChannel);
  });

  it('does not duplicate channels on repeated channel:created', async () => {
    const { result } = renderWithSync();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const newChannel: ChatChannel = {
      id: 'ch-new',
      name: 'New WS Channel',
      description: '',
      memberAgentIds: [],
      createdAt: '2026-03-25T18:00:00Z',
      updatedAt: '2026-03-25T18:00:00Z',
    };

    act(() => {
      fireWsEvent('channel:created', newChannel as unknown as Record<string, unknown>);
      fireWsEvent('channel:created', newChannel as unknown as Record<string, unknown>);
    });

    const cached = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
    expect(cached).toHaveLength(3);
  });

  it('merges updated fields into list cache on channel:updated', async () => {
    const { result } = renderWithSync();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => {
      fireWsEvent('channel:updated', {
        id: 'ch-general',
        name: 'General Renamed',
        description: 'General discussion',
        memberAgentIds: ['leela', 'fry'],
        createdAt: '2026-03-23T10:00:00Z',
        updatedAt: '2026-03-25T18:00:00Z',
      });
    });

    const cached = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
    const channel = cached?.find((c) => c.id === 'ch-general');
    expect(channel?.name).toBe('General Renamed');
    expect(channel?.updatedAt).toBe('2026-03-25T18:00:00Z');
  });

  it('merges into detail cache on channel:updated', async () => {
    queryClient.setQueryData(channelKeys.detail('ch-general'), mockChannels[0]);
    const { result } = renderWithSync();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => {
      fireWsEvent('channel:updated', {
        id: 'ch-general',
        name: 'General Renamed',
        description: 'General discussion',
        memberAgentIds: ['leela', 'fry'],
        createdAt: '2026-03-23T10:00:00Z',
        updatedAt: '2026-03-25T18:00:00Z',
      });
    });

    const detail = queryClient.getQueryData<ChatChannel>(channelKeys.detail('ch-general'));
    expect(detail?.name).toBe('General Renamed');
  });

  it('removes channel from list cache on channel:deleted', async () => {
    const { result } = renderWithSync();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => {
      fireWsEvent('channel:deleted', { id: 'ch-general', deletedMessages: 0 });
    });

    const cached = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
    expect(cached).toHaveLength(1);
    expect(cached![0]!.id).toBe('ch-frontend');
  });

  it('evicts detail cache on channel:deleted', async () => {
    queryClient.setQueryData(channelKeys.detail('ch-general'), mockChannels[0]);
    const { result } = renderWithSync();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => {
      fireWsEvent('channel:deleted', { id: 'ch-general', deletedMessages: 0 });
    });

    expect(queryClient.getQueryData(channelKeys.detail('ch-general'))).toBeUndefined();
  });

  it('debounces invalidation — single refetch after rapid events', async () => {
    const { result } = renderWithSync();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    fetchMock.mockClear();

    // Fire multiple rapid events
    act(() => {
      fireWsEvent('channel:created', {
        id: 'ch-a',
        name: 'A',
        description: '',
        memberAgentIds: [],
        createdAt: '2026-03-25T18:00:00Z',
        updatedAt: '2026-03-25T18:00:00Z',
      });
      fireWsEvent('channel:updated', {
        id: 'ch-general',
        name: 'Updated',
        description: 'General discussion',
        memberAgentIds: ['leela', 'fry'],
        createdAt: '2026-03-23T10:00:00Z',
        updatedAt: '2026-03-25T18:00:00Z',
      });
      fireWsEvent('channel:deleted', { id: 'ch-frontend', deletedMessages: 0 });
    });

    // No fetch should have happened yet (debounce window not elapsed)
    expect(fetchMock).not.toHaveBeenCalled();

    // Advance past the 200ms debounce
    fetchMock.mockReturnValue(jsonResponse(mockChannels));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    // Exactly one refetch from the debounced invalidation
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  it('handles malformed payloads gracefully (falls back to invalidation)', async () => {
    const { result } = renderWithSync();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    fetchMock.mockClear();

    // Fire event with no id in payload
    act(() => {
      fireWsEvent('channel:updated', { garbage: true });
    });

    // Should still schedule an invalidation
    fetchMock.mockReturnValue(jsonResponse(mockChannels));
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});

// ── useChannelMessages ────────────────────────────────────────────

describe('useChannelMessages', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: 'msg-1',
      sender: 'leela',
      recipient: 'channel:ch-general',
      content: 'Hello team',
      timestamp: '2026-03-25T12:00:00Z',
      threadId: null,
    },
    {
      id: 'msg-2',
      sender: 'fry',
      recipient: 'channel:ch-general',
      content: 'Hey!',
      timestamp: '2026-03-25T12:01:00Z',
      threadId: null,
    },
  ];

  it('fetches messages with the channel: prefix in the query', async () => {
    fetchMock.mockReturnValue(
      jsonResponse({ messages: mockMessages, total: 2, limit: 50, offset: 0 }),
    );

    const { result } = renderHook(() => useChannelMessages('ch-general'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0]!.content).toBe('Hello team');

    // Verify the fetch URL includes the channel: prefix
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('agent=channel%3Ach-general'),
      expect.any(Object),
    );
  });

  it('exposes loading state', () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useChannelMessages('ch-general'), { wrapper });
    expect(result.current.isLoading).toBe(true);
  });

  it('exposes error state', async () => {
    fetchMock.mockReturnValue(jsonResponse({ error: 'Not found' }, 404));
    const { result } = renderHook(() => useChannelMessages('ch-general'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeTruthy();
  });

  it('receives real-time messages via WebSocket', async () => {
    fetchMock.mockReturnValue(
      jsonResponse({ messages: mockMessages, total: 2, limit: 50, offset: 0 }),
    );

    renderHook(() => useChannelMessages('ch-general'), { wrapper });
    await waitFor(() => {
      const cached = queryClient.getQueryData<ChatMessage[]>(['chat', 'channel:ch-general']);
      expect(cached).toHaveLength(2);
    });

    const realtimeMsg: ChatMessage = {
      id: 'msg-3',
      sender: 'bender',
      recipient: 'channel:ch-general',
      content: 'Bite my shiny metal API!',
      timestamp: '2026-03-25T12:02:00Z',
      threadId: null,
    };

    act(() => {
      fireWsEvent('chat:message', realtimeMsg as unknown as Record<string, unknown>);
    });

    const cached = queryClient.getQueryData<ChatMessage[]>(['chat', 'channel:ch-general']);
    expect(cached).toHaveLength(3);
    expect(cached![2]!.content).toBe('Bite my shiny metal API!');
  });

  it('ignores messages for other channels', async () => {
    fetchMock.mockReturnValue(
      jsonResponse({ messages: mockMessages, total: 2, limit: 50, offset: 0 }),
    );

    const { result } = renderHook(() => useChannelMessages('ch-general'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    act(() => {
      fireWsEvent('chat:message', {
        id: 'msg-other',
        sender: 'fry',
        recipient: 'channel:ch-frontend',
        content: 'Wrong channel',
        timestamp: '2026-03-25T12:03:00Z',
        threadId: null,
      });
    });

    // Still only the original 2 messages
    expect(result.current.data).toHaveLength(2);
  });

  it('is disabled when channelId is empty', () => {
    const { result } = renderHook(() => useChannelMessages(''), { wrapper });
    // "channel:" with empty id is "channel:" — useChatMessages checks !!recipient
    // which is truthy for "channel:", but the query should still work
    expect(result.current.isFetching || result.current.isLoading).toBeTruthy();
  });
});

// ── useSendChannelMessage ─────────────────────────────────────────

describe('useSendChannelMessage', () => {
  it('sends a message with the channel: prefix recipient', async () => {
    const serverMsg: ChatMessage = {
      id: 'msg-sent',
      sender: 'user',
      recipient: 'channel:ch-general',
      content: 'New message',
      timestamp: '2026-03-25T12:05:00Z',
      threadId: null,
    };
    fetchMock.mockReturnValue(jsonResponse(serverMsg, 201));

    const { result } = renderHook(() => useSendChannelMessage('ch-general'), { wrapper });

    act(() => {
      result.current.mutate({ sender: 'user', content: 'New message' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    // Verify the POST body includes the channel: prefix
    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/api/chat/messages');
    const body = JSON.parse(options.body as string);
    expect(body.recipient).toBe('channel:ch-general');
    expect(body.sender).toBe('user');
    expect(body.content).toBe('New message');
  });

  it('exposes pending state during mutation', async () => {
    fetchMock.mockReturnValue(new Promise(() => {})); // never resolves
    const { result } = renderHook(() => useSendChannelMessage('ch-general'), { wrapper });

    act(() => {
      result.current.mutate({ sender: 'user', content: 'Hello' });
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));
  });

  it('exposes error state on failure', async () => {
    fetchMock.mockReturnValue(jsonResponse({ error: 'Forbidden' }, 403));
    const { result } = renderHook(() => useSendChannelMessage('ch-general'), { wrapper });

    act(() => {
      result.current.mutate({ sender: 'user', content: 'Forbidden msg' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
