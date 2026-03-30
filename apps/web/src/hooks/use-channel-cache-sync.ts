import type { ChatChannel } from '@matanelcohen/openspace-shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { useWsEvent } from '@/components/providers/websocket-provider';
import type { WsEnvelope } from '@/hooks/use-websocket';

import { channelKeys } from './use-channels';

// ── Constants ─────────────────────────────────────────────────────

/** Trailing debounce window for the invalidation backstop. */
const INVALIDATION_DEBOUNCE_MS = 200;

// ── Hook ──────────────────────────────────────────────────────────

/**
 * Centralised WebSocket → TanStack Query cache synchronisation for channels.
 *
 * Strategy:
 *  1. **Granular** — `setQueryData` patches the list and detail caches
 *     immediately on each event (append / merge / remove).
 *  2. **Backstop** — a debounced `invalidateQueries` fires after a
 *     200 ms quiet period to guarantee eventual consistency with the
 *     server, coalescing rapid bursts into a single refetch.
 */
export function useChannelCacheSync() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const scheduleInvalidation = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      queryClient.invalidateQueries({ queryKey: channelKeys.all });
    }, INVALIDATION_DEBOUNCE_MS);
  }, [queryClient]);

  // ── channel:created ───────────────────────────────────────────

  useWsEvent(
    'channel:created',
    useCallback(
      (envelope: WsEnvelope) => {
        const channel = envelope.payload as unknown as ChatChannel;
        if (!channel?.id) {
          scheduleInvalidation();
          return;
        }

        // Append to list cache
        queryClient.setQueryData<ChatChannel[]>(channelKeys.all, (old) => {
          if (!old) return undefined; // let the backstop refetch
          // Avoid duplicates (e.g. from our own optimistic create)
          if (old.some((ch) => ch.id === channel.id)) return old;
          return [...old, channel];
        });

        // Seed the detail cache
        queryClient.setQueryData<ChatChannel>(channelKeys.detail(channel.id), channel);

        scheduleInvalidation();
      },
      [queryClient, scheduleInvalidation],
    ),
  );

  // ── channel:updated ───────────────────────────────────────────

  useWsEvent(
    'channel:updated',
    useCallback(
      (envelope: WsEnvelope) => {
        const channel = envelope.payload as unknown as ChatChannel;
        if (!channel?.id) {
          scheduleInvalidation();
          return;
        }

        // Merge into list cache
        queryClient.setQueryData<ChatChannel[]>(channelKeys.all, (old) => {
          if (!old) return undefined;
          return old.map((ch) => (ch.id === channel.id ? { ...ch, ...channel } : ch));
        });

        // Update detail cache if present
        queryClient.setQueryData<ChatChannel>(channelKeys.detail(channel.id), (old) => {
          if (!old) return undefined;
          return { ...old, ...channel };
        });

        scheduleInvalidation();
      },
      [queryClient, scheduleInvalidation],
    ),
  );

  // ── channel:deleted ───────────────────────────────────────────

  useWsEvent(
    'channel:deleted',
    useCallback(
      (envelope: WsEnvelope) => {
        const { id } = envelope.payload as { id?: string };
        if (!id) {
          scheduleInvalidation();
          return;
        }

        // Remove from list cache
        queryClient.setQueryData<ChatChannel[]>(channelKeys.all, (old) => {
          if (!old) return undefined;
          return old.filter((ch) => ch.id !== id);
        });

        // Evict detail cache
        queryClient.removeQueries({ queryKey: channelKeys.detail(id) });

        scheduleInvalidation();
      },
      [queryClient, scheduleInvalidation],
    ),
  );
}
