import type { SquadOverview } from '@openspace/shared';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export function useSquad() {
  return useQuery<SquadOverview>({
    queryKey: ['squad'],
    queryFn: () => api.get<SquadOverview>('/api/squad'),
    refetchInterval: 30_000,
  });
}
