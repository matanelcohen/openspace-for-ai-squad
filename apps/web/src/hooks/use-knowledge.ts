'use client';

import type { RAGSearchRequest, RAGSearchResponse, RAGStats } from '@openspace/shared';
import { useMutation, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export function useKnowledgeStats() {
  return useQuery<RAGStats>({
    queryKey: ['knowledge', 'stats'],
    queryFn: () => api.get<RAGStats>('/api/knowledge/stats'),
    refetchInterval: 60_000, // refresh every minute
  });
}

export function useKnowledgeSearch() {
  return useMutation<RAGSearchResponse, Error, RAGSearchRequest>({
    mutationFn: (request) => api.post<RAGSearchResponse>('/api/knowledge/search', request),
  });
}
