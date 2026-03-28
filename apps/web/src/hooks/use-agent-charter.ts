'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

interface CharterResponse {
  agentId: string;
  charter: string | null;
  error?: string;
}

interface UpdateCharterResponse {
  agentId: string;
  charter: string;
  success: boolean;
}

export function useAgentCharter(agentId: string) {
  return useQuery<CharterResponse>({
    queryKey: ['agent-charter', agentId],
    queryFn: async () => {
      try {
        return await api.get<CharterResponse>(`/api/agents/${agentId}/charter`);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'status' in err && err.status === 404) {
          return { agentId, charter: null };
        }
        throw err;
      }
    },
    enabled: !!agentId,
  });
}

export function useUpdateAgentCharter() {
  const queryClient = useQueryClient();
  return useMutation<UpdateCharterResponse, Error, { agentId: string; charter: string }>({
    mutationFn: ({ agentId, charter }) =>
      api.put<UpdateCharterResponse>(`/api/agents/${agentId}/charter`, { charter }),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['agent-charter', variables.agentId] });
      // Also invalidate agent detail since charter affects parsed identity/boundaries
      void queryClient.invalidateQueries({ queryKey: ['agents'] });
    },
  });
}
