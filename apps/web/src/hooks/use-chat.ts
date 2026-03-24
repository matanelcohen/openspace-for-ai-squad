import type { ChatMessage } from '@openspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { useWsEvent } from '@/components/providers/websocket-provider';
import type { WsEnvelope } from '@/hooks/use-websocket';
import { api } from '@/lib/api-client';

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

    // Add the message to the cache if it belongs to this channel
    const isRelevant = msg.sender === recipient || msg.recipient === recipient;

    if (isRelevant) {
      queryClient.setQueryData<ChatMessage[]>(['chat', recipient], (old = []) => {
        // Avoid duplicates (from optimistic update or refetch)
        if (old.some((m) => m.id === msg.id)) return old;
        return [...old, msg];
      });
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
    onSuccess: (_data, variables) => {
      // Refetch to get the real messages (user's + AI response)
      queryClient.invalidateQueries({ queryKey: ['chat', variables.recipient] });
    },
    onError: (_err, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['chat', variables.recipient], context.previous);
      }
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
