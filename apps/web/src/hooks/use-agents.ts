import type { Agent } from '@matanelcohen/openspace-shared';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export function useAgents() {
  return useQuery<Agent[]>({
    queryKey: ['agents'],
    queryFn: () => api.get<Agent[]>('/api/agents'),
    refetchInterval: 300_000, // 5 min fallback — real-time updates via WebSocket
  });
}
