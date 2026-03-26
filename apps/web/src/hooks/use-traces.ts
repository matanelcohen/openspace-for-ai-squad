import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { Trace, TraceStats, TraceSummary } from '@/lib/trace-types';

/**
 * Fetch the list of trace summaries from the backend API.
 */
export function useTraces() {
  return useQuery<TraceSummary[]>({
    queryKey: ['traces'],
    queryFn: () => api.get<TraceSummary[]>('/api/traces'),
    staleTime: 10_000,
  });
}

/**
 * Fetch a single trace with its full span tree.
 */
export function useTrace(traceId: string) {
  return useQuery<Trace | undefined>({
    queryKey: ['traces', traceId],
    queryFn: () => api.get<Trace>(`/api/traces/${traceId}`),
    enabled: !!traceId,
  });
}

/**
 * Fetch aggregate trace statistics.
 */
export function useTraceStats() {
  return useQuery<TraceStats>({
    queryKey: ['trace-stats'],
    queryFn: () => api.get<TraceStats>('/api/traces/stats'),
    staleTime: 30_000,
  });
}
