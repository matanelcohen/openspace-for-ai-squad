import type { Decision } from '@openspace/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect,useState } from 'react';

import { api } from '@/lib/api-client';

export function useDecisionSearch(query: string, debounceMs = 300) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return useQuery({
    queryKey: ['decisions', 'search', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery.trim()) {
        return [];
      }
      const response = await api.get(`/api/decisions/search?q=${encodeURIComponent(debouncedQuery)}`);
      return response.data as Decision[];
    },
    enabled: debouncedQuery.trim().length > 0,
  });
}
