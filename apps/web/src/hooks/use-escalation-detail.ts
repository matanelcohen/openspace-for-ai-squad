import type { EscalationItem } from '@openspace/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { useWsEvent } from '@/components/providers/websocket-provider';
import { api } from '@/lib/api-client';

export function useEscalationDetail(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery<EscalationItem>({
    queryKey: ['escalation', id],
    queryFn: () => api.get<EscalationItem>(`/api/escalations/${id}`),
    enabled: !!id,
  });

  useWsEvent('escalation:updated', (envelope) => {
    const payload = envelope.payload as { id?: string };
    if (payload.id === id) {
      queryClient.invalidateQueries({ queryKey: ['escalation', id] });
    }
  });

  return query;
}
