import { useQuery } from '@tanstack/react-query';

import { getMockTrace, getMockTraces, getMockTraceStats } from '@/lib/mock-traces';
import type { Trace, TraceStats, TraceSummary } from '@/lib/trace-types';

/**
 * Fetch the list of trace summaries.
 * Uses mock data during development — swap to api.get() when backend is ready.
 */
export function useTraces() {
  return useQuery<TraceSummary[]>({
    queryKey: ['traces'],
    queryFn: async () => {
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 300));
      return getMockTraces();
    },
    staleTime: 60_000,
  });
}

/**
 * Fetch a single trace with its full span tree.
 */
export function useTrace(traceId: string) {
  return useQuery<Trace | undefined>({
    queryKey: ['traces', traceId],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 200));
      return getMockTrace(traceId);
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
      await new Promise((r) => setTimeout(r, 250));
      return getMockTraceStats();
    },
    staleTime: 60_000,
  });
}
