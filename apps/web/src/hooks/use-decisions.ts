import type { Decision } from '@openspace/shared';
import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export function useDecisions() {
  return useQuery({
    queryKey: ['decisions'],
    queryFn: async () => {
      const response = await api.get('/api/decisions');
      return response.data as Decision[];
    },
  });
}
