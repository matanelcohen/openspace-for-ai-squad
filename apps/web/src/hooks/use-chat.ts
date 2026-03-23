import type { ChatMessage } from '@openspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export function useChatMessages(recipient: string) {
  return useQuery<ChatMessage[]>({
    queryKey: ['chat', recipient],
    queryFn: () =>
      api.get<ChatMessage[]>(
        `/api/chat/messages?limit=50&offset=0&agent=${encodeURIComponent(recipient)}`,
      ),
    enabled: !!recipient,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { sender: string; recipient: string; content: string }) =>
      api.post<ChatMessage>('/api/chat/messages', input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat', variables.recipient] });
    },
  });
}
