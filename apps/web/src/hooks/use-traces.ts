import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import { getMockTrace, getMockTraces, getMockTraceStats } from '@/lib/mock-traces';
import type { Trace, TraceStats, TraceSummary } from '@/lib/trace-types';

/**
 * Fetch the list of trace summaries from the backend API.
 * Falls back to mock data if the API is unavailable.
 */
export function useTraces() {
  return useQuery<TraceSummary[]>({
    queryKey: ['traces'],
    queryFn: async () => {
      try {
        return await api.get<TraceSummary[]>('/api/traces');
      } catch {
        // Fallback to mock data when API is unavailable
        return getMockTraces();
      }
    },
    staleTime: 10_000,
  });
}

/**
 * Fetch a single trace with its full span tree.
 */
export function useTrace(traceId: string) {
  return useQuery<Trace | undefined>({
    queryKey: ['traces', traceId],
    queryFn: async () => {
      try {
        return await api.get<Trace>(`/api/traces/${traceId}`);
      } catch {
        // Fallback to mock data when API is unavailable
        return getMockTrace(traceId);
      }
    },
    enabled: !!traceId,
  });
}

/**
 * Fetch aggregate trace statistics.
 */
export function useTraceStats() {
  return useQuery<TraceStats>({
    queryKey: ['trace-stats'],
    queryFn: async () => {
      try {
        return await api.get<TraceStats>('/api/traces/stats');
      } catch {
        // Fallback to mock data when API is unavailable
        return getMockTraceStats();
      }
    },
    staleTime: 30_000,
  });
}
