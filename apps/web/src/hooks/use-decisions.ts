import type { Decision } from '@openspace/shared';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export function useDecisions() {
  return useQuery<Decision[]>({
    queryKey: ['decisions'],
    queryFn: () => api.get<Decision[]>('/api/decisions'),
  });
}
