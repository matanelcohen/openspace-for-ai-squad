import type { ChatChannel } from '@openspace/shared';
import { CHAT_CHANNEL_PREFIX } from '@openspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useChannelCacheSync } from '@/hooks/use-channel-cache-sync';
import { useChatMessages, useSendMessage } from '@/hooks/use-chat';
import { api } from '@/lib/api-client';

// Re-export Channel types for consumers
export type { ChatChannel } from '@openspace/shared';
export type { Channel } from '@openspace/shared';

/** Centralised query-key factory for channel queries. */
export const channelKeys = {
  all: ['channels'] as const,
  detail: (id: string) => ['channels', id] as const,
};

/** How long channel data stays fresh before a background refetch (30 s). */
const CHANNEL_STALE_TIME = 30_000;
/** How long unused channel data remains in the cache (5 min). */
const CHANNEL_GC_TIME = 5 * 60_000;

// ── Query hooks ─────────────────────────────────────────────────────

/** Fetch all channels. */
export function useChannels() {
  // Centralised WS → cache sync (debounced + granular)
  useChannelCacheSync();

  return useQuery<ChatChannel[]>({
    queryKey: channelKeys.all,
    queryFn: () => api.get<ChatChannel[]>('/api/channels'),
    staleTime: CHANNEL_STALE_TIME,
    gcTime: CHANNEL_GC_TIME,
  });
}

/** Fetch a single channel by ID. */
export function useChannel(id: string) {
  return useQuery<ChatChannel>({
    queryKey: channelKeys.detail(id),
    queryFn: () => api.get<ChatChannel>(`/api/channels/${encodeURIComponent(id)}`),
    staleTime: CHANNEL_STALE_TIME,
    gcTime: CHANNEL_GC_TIME,
    enabled: !!id,
  });
}

// ── Mutation hooks ──────────────────────────────────────────────────

/** Create a new channel with optimistic cache update. */
export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; description?: string; memberAgentIds?: string[] }) =>
      api.post<ChatChannel>('/api/channels', input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: channelKeys.all });
      const previous = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
      const optimistic: ChatChannel = {
        id: `temp-${Date.now()}`,
        name: input.name,
        description: input.description ?? '',
        memberAgentIds: input.memberAgentIds ?? [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ChatChannel[]>(channelKeys.all, (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(channelKeys.all, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
    },
  });
}

/** Update an existing channel with optimistic cache update. */
export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      description?: string;
      memberAgentIds?: string[];
    }) => api.patch<ChatChannel>(`/api/channels/${encodeURIComponent(id)}`, input),
    onMutate: async ({ id, ...input }) => {
      await queryClient.cancelQueries({ queryKey: channelKeys.all });
      await queryClient.cancelQueries({ queryKey: channelKeys.detail(id) });
      const previous = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
      queryClient.setQueryData<ChatChannel[]>(channelKeys.all, (old) =>
        old?.map((ch) =>
          ch.id === id ? { ...ch, ...input, updatedAt: new Date().toISOString() } : ch,
        ),
      );
      // Also update the detail cache if it exists
      const previousDetail = queryClient.getQueryData<ChatChannel>(channelKeys.detail(id));
      if (previousDetail) {
        queryClient.setQueryData<ChatChannel>(channelKeys.detail(id), {
          ...previousDetail,
          ...input,
          updatedAt: new Date().toISOString(),
        });
      }
      return { previous, previousDetail };
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(channelKeys.all, context.previous);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(channelKeys.detail(id), context.previousDetail);
      }
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
      queryClient.invalidateQueries({ queryKey: channelKeys.detail(id) });
    },
  });
}

/** Delete a channel. */
export function useDeleteChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/api/channels/${encodeURIComponent(id)}`),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
      queryClient.removeQueries({ queryKey: channelKeys.detail(id) });
    },
  });
}

// ── Channel-scoped message hooks ────────────────────────────────

/** Build the recipient string from a plain channel ID. */
function channelRecipient(channelId: string): string {
  return `${CHAT_CHANNEL_PREFIX}${channelId}`;
}

/**
 * Fetch messages for a channel and subscribe to real-time updates.
 *
 * Wraps `useChatMessages` so callers pass only the channel ID
 * without needing to know the `"channel:"` prefix convention.
 *
 * Returns the standard TanStack Query result with `data`, `isLoading`,
 * `isError`, `error`, and `isSuccess` fields.
 */
export function useChannelMessages(channelId: string) {
  return useChatMessages(channelRecipient(channelId));
}

/**
 * Send a message to a channel.
 *
 * Returns a mutation whose `mutate` / `mutateAsync` accepts
 * `{ sender, content }` — the channel recipient is injected automatically.
 */
export function useSendChannelMessage(channelId: string) {
  const send = useSendMessage();

  return {
    ...send,
    mutate: (
      input: { sender: string; content: string },
      options?: Parameters<typeof send.mutate>[1],
    ) => send.mutate({ ...input, recipient: channelRecipient(channelId) }, options),
    mutateAsync: (input: { sender: string; content: string }) =>
      send.mutateAsync({ ...input, recipient: channelRecipient(channelId) }),
  };
}
