import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export interface CostSummary {
  totalCost: number;
  totalTokens: { prompt: number; completion: number };
  byAgent: Record<string, { cost: number; tokens: number; tasks: number }>;
  byModel: Record<string, { cost: number; tokens: number; calls: number }>;
  byDay: Array<{ date: string; cost: number }>;
}

export function useCosts(period?: string) {
  return useQuery<CostSummary>({
    queryKey: ['costs', period],
    queryFn: () => api.get<CostSummary>('/api/costs' + (period ? `?period=${period}` : '')),
    staleTime: 30_000,
  });
}
