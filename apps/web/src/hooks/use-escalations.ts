import type { EscalationItem } from '@matanelcohen/openspace-shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useWsEvent } from '@/components/providers/websocket-provider';
import { api } from '@/lib/api-client';

interface EscalationResponse {
  items: EscalationItem[];
  total: number;
  limit: number;
  offset: number;
}

export function useEscalations() {
  const queryClient = useQueryClient();

  const query = useQuery<EscalationItem[]>({
    queryKey: ['escalations'],
    queryFn: async () => {
      const res = await api.get<EscalationResponse>('/api/escalations');
      return Array.isArray(res) ? res : res.items ?? [];
    },
  });

  useWsEvent('escalation:created', () => {
    queryClient.invalidateQueries({ queryKey: ['escalations'] });
  });

  useWsEvent('escalation:updated', () => {
    queryClient.invalidateQueries({ queryKey: ['escalations'] });
  });

  return query;
}

export function usePendingEscalationCount() {
  const { data } = useEscalations();
  return data?.filter((e) => e.status === 'pending' || e.status === 'claimed').length ?? 0;
}
