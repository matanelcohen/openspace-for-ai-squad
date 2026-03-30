import type { EscalationItem } from '@matanelcohen/openspace-shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { useWsEvent } from '@/components/providers/websocket-provider';
import { api } from '@/lib/api-client';

export function useEscalations() {
  const queryClient = useQueryClient();

  const query = useQuery<EscalationItem[]>({
    queryKey: ['escalations'],
    queryFn: () => api.get<EscalationItem[]>('/api/escalations'),
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
