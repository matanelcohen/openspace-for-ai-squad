import type { ChatMessage } from '@matanelcohen/openspace-shared';
import { CHAT_CHANNEL_PREFIX } from '@matanelcohen/openspace-shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useWsEvent, useWsSend } from '@/components/providers/websocket-provider';
import type { WsEnvelope } from '@/hooks/use-websocket';
import { api } from '@/lib/api-client';

/** Extract the channelId from a recipient string like "channel:abc123". */
export function extractChannelId(recipient: string): string | undefined {
  return recipient.startsWith(CHAT_CHANNEL_PREFIX)
    ? recipient.slice(CHAT_CHANNEL_PREFIX.length)
    : undefined;
}

/** Shape returned by GET /api/chat/messages (paginated envelope). */
interface ChatMessagesResponse {
  messages: ChatMessage[];
  total: number;
  limit: number;
  offset: number;
}

export function useChatMessages(recipient: string) {
  const queryClient = useQueryClient();

  // Listen for real-time chat messages via WebSocket
  // Route each message to the correct channel cache regardless of which channel is viewed
  useWsEvent('chat:message', (envelope: WsEnvelope) => {
    const payload = envelope.payload as unknown as ChatMessage & { workspaceId?: string };
    if (!payload?.id) return;

    // Ignore messages from other workspaces
    const storedWs = typeof window !== 'undefined' ? localStorage.getItem('openspace:active-workspace') : null;
    if (payload.workspaceId && storedWs && payload.workspaceId !== storedWs) return;

    const msg = payload;

    // Determine which cache key(s) this message belongs to
    const targets: string[] = [];

    const channelId = extractChannelId(msg.recipient);
    if (channelId) {
      // Channel message — goes to that channel's cache
      targets.push(msg.recipient);
    } else if (msg.recipient === 'team') {
      // Team message — goes to team cache
      targets.push('team');
    } else {
      // DM — goes to the agent's cache (whether sender or recipient)
      // e.g. user→leela and leela→leela both go to 'leela' cache
      const agentId = msg.sender === 'user' ? msg.recipient : msg.sender;
      targets.push(agentId);
    }

    for (const cacheKey of targets) {
      queryClient.setQueryData<ChatMessage[]>(['chat', cacheKey], (old = []) => {
        if (old.some((m) => m.id === msg.id)) return old;

        const msgContentTrimmed = msg.content.trim();
        const cleaned = old.filter((m) => {
          if (!m.id.startsWith('optimistic-')) return true;
          return !(m.sender === msg.sender && m.content.trim() === msgContentTrimmed);
        });

        const msgTime = new Date(msg.timestamp).getTime();
        const isDuplicate = cleaned.some(
          (m) =>
            m.sender === msg.sender &&
            m.content.trim() === msgContentTrimmed &&
            Math.abs(new Date(m.timestamp).getTime() - msgTime) < 5000,
        );
        if (isDuplicate) return old;

        const updated = [...cleaned, msg];
        updated.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return updated;
      });
    }
  });

  // Listen for chat:cleared events from other clients so every tab stays in sync
  useWsEvent('chat:cleared', (envelope: WsEnvelope) => {
    const { agent } = envelope.payload as { agent?: string };
    if (!agent || agent === recipient) {
      queryClient.setQueryData<ChatMessage[]>(['chat', recipient], []);
    }
  });

  return useQuery<ChatMessage[]>({
    queryKey: ['chat', recipient],
    queryFn: async () => {
      const res = await api.get<ChatMessagesResponse>(
        `/api/chat/messages?limit=50&offset=0&agent=${encodeURIComponent(recipient)}`,
      );
      // The API returns a paginated envelope -- extract the array.
      return res.messages;
    },
    enabled: !!recipient,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { sender: string; recipient: string; content: string }) =>
      api.post<ChatMessage>('/api/chat/messages', input),
    onMutate: async (input) => {
      // Cancel outgoing refetches so they don't overwrite our optimistic update
      await queryClient.cancelQueries({ queryKey: ['chat', input.recipient] });

      const previous = queryClient.getQueryData<ChatMessage[]>(['chat', input.recipient]);

      // Optimistically add the user's message immediately
      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        sender: input.sender,
        recipient: input.recipient,
        content: input.content,
        timestamp: new Date().toISOString(),
        threadId: null,
      };

      queryClient.setQueryData<ChatMessage[]>(['chat', input.recipient], (old = []) => [
        ...old,
        optimistic,
      ]);

      return { previous };
    },
    onSuccess: () => {
      // Don't refetch — WebSocket handler adds the real message
      // and removes the optimistic one automatically.
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['chat', variables.recipient], context.previous);
      }
    },
  });
}

/**
 * Clear messages for a specific channel (agent or team).
 * Pass `undefined` to the mutation to clear **all** channels.
 */
export function useClearChat() {
  const queryClient = useQueryClient();
  const wsSend = useWsSend();

  return useMutation({
    mutationFn: async (agent?: string) => {
      const params = agent ? `?agent=${encodeURIComponent(agent)}` : '';
      const res = await api.delete<{ deleted: number }>(`/api/chat/messages${params}`);
      return res;
    },
    onSuccess: (_data, agent) => {
      if (agent) {
        queryClient.setQueryData<ChatMessage[]>(['chat', agent], []);
      } else {
        queryClient.invalidateQueries({ queryKey: ['chat'] });
      }
      wsSend({ type: 'chat:cleared', payload: { agent: agent ?? undefined } });
    },
  });
}

/** Track which agents are currently typing via WebSocket events. */
export function useTypingIndicator() {
  // Map<agentId, { name, recipient }>
  const [typingAgents, setTypingAgents] = useState<Map<string, { name: string; recipient: string }>>(new Map());

  // Clear typing when agent's message arrives
  useWsEvent(
    'chat:message',
    useCallback((envelope: WsEnvelope) => {
      const msg = envelope.payload as unknown as ChatMessage;
      if (!msg?.sender || msg.sender === 'user') return;
      setTypingAgents((prev) => {
        if (!prev.has(msg.sender)) return prev;
        const next = new Map(prev);
        next.delete(msg.sender);
        return next;
      });
    }, []),
  );

  useWsEvent(
    'chat:typing',
    useCallback((envelope: WsEnvelope) => {
      const { agentId, agentName, isTyping, recipient, workspaceId } = envelope.payload as {
        agentId: string;
        agentName?: string;
        isTyping: boolean;
        recipient?: string;
        workspaceId?: string;
      };
      if (!agentId) return;

      // Ignore typing from other workspaces
      const storedWs = typeof window !== 'undefined' ? localStorage.getItem('openspace:active-workspace') : null;
      if (workspaceId && storedWs && workspaceId !== storedWs) return;

      setTypingAgents((prev) => {
        const next = new Map(prev);
        if (isTyping) {
          next.set(agentId, { name: agentName ?? agentId, recipient: recipient ?? 'team' });
        } else {
          next.delete(agentId);
        }
        return next;
      });
    }, []),
  );

  return typingAgents;
}

/** Track unread message counts per channel. */
export function useUnreadCounts(currentChannel: string) {
  const [unread, setUnread] = useState<Map<string, number>>(new Map());

  // Increment unread when a message arrives for a channel we're not viewing
  useWsEvent(
    'chat:message',
    useCallback(
      (envelope: WsEnvelope) => {
        const msg = envelope.payload as unknown as ChatMessage;
        if (!msg?.id || msg.sender === 'user') return;

        // Determine the channel key for this message
        const channelKey =
          msg.recipient === 'team'
            ? 'team'
            : msg.sender === 'user'
              ? msg.recipient
              : msg.sender;

        // Only count as unread if we're NOT viewing this channel
        if (channelKey === currentChannel) return;

        setUnread((prev) => {
          const next = new Map(prev);
          next.set(channelKey, (next.get(channelKey) ?? 0) + 1);
          return next;
        });
      },
      [currentChannel],
    ),
  );

  const clearUnread = useCallback((channel: string) => {
    setUnread((prev) => {
      if (!prev.has(channel)) return prev;
      const next = new Map(prev);
      next.delete(channel);
      return next;
    });
  }, []);

  return { unread, clearUnread };
}
