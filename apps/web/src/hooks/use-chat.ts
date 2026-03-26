import type { ChatMessage } from '@openspace/shared';
import { CHAT_CHANNEL_PREFIX } from '@openspace/shared';
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
  useWsEvent('chat:message', (envelope: WsEnvelope) => {
    const msg = envelope.payload as unknown as ChatMessage;
    if (!msg?.id) return;

    // Route the message to this channel view only if it belongs here.
    // For channels (recipient starts with "channel:"), match on recipient.
    // For DMs, match on sender (incoming) or recipient (outgoing).
    const channelId = extractChannelId(recipient);
    const isRelevant = channelId
      ? msg.recipient === recipient
      : msg.sender === recipient || msg.recipient === recipient;

    if (isRelevant) {
      queryClient.setQueryData<ChatMessage[]>(['chat', recipient], (old = []) => {
        // Avoid duplicates (from optimistic update or refetch)
        if (old.some((m) => m.id === msg.id)) return old;
        // Remove optimistic messages that this real message supersedes
        const cleaned = old.filter(
          (m) =>
            !(
              m.id.startsWith('optimistic-') &&
              m.content === msg.content &&
              m.sender === msg.sender
            ),
        );
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
  const [typingAgents, setTypingAgents] = useState<Map<string, string>>(new Map());

  useWsEvent(
    'chat:typing',
    useCallback((envelope: WsEnvelope) => {
      const { agentId, agentName, isTyping } = envelope.payload as {
        agentId: string;
        agentName?: string;
        isTyping: boolean;
      };
      if (!agentId) return;

      setTypingAgents((prev) => {
        const next = new Map(prev);
        if (isTyping) {
          next.set(agentId, agentName ?? agentId);
        } else {
          next.delete(agentId);
        }
        return next;
      });
    }, []),
  );

  return typingAgents;
}
