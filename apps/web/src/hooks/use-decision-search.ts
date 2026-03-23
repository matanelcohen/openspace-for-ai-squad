import type { Decision } from '@openspace/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { api } from '@/lib/api-client';

export function useDecisionSearch(query: string, debounceMs = 300) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, debounceMs]);

  return useQuery<Decision[]>({
    queryKey: ['decisions', 'search', debouncedQuery],
    queryFn: () =>
      api.get<Decision[]>(`/api/decisions/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.trim().length > 0,
  });
}
