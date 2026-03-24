import type { ChatMessage } from '@openspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

/** Shape returned by GET /api/chat/messages (paginated envelope). */
interface ChatMessagesResponse {
  messages: ChatMessage[];
  total: number;
  limit: number;
  offset: number;
}

export function useChatMessages(recipient: string) {
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
