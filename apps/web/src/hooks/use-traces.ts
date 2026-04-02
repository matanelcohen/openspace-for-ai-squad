import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';
import type { Trace, TraceStats, TraceSummary } from '@/lib/trace-types';

/** Shape returned by GET /api/traces (paginated envelope). */
export interface TracesResponse {
  data: TraceSummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface UseTracesParams {
  page?: number;
  limit?: number;
  status?: string;
  agent?: string;
  search?: string;
  sort?: string;
  sortDir?: 'asc' | 'desc';
}

/**
 * Fetch the list of trace summaries from the backend API (paginated).
 */
export function useTraces(params: UseTracesParams = {}) {
  const { page = 0, limit = 50, status, agent, search, sort, sortDir } = params;
  const offset = page * limit;

  const qp = new URLSearchParams();
  qp.set('limit', String(limit));
  qp.set('offset', String(offset));
  if (status && status !== 'all') qp.set('status', status);
  if (agent && agent !== 'all') qp.set('agent', agent);
  if (search) qp.set('search', search);
  if (sort) qp.set('sort', sort);
  if (sortDir) qp.set('sortDir', sortDir);

  return useQuery<TracesResponse>({
    queryKey: ['traces', { page, limit, status, agent, search, sort, sortDir }],
    queryFn: () => api.get<TracesResponse>(`/api/traces?${qp.toString()}`),
    staleTime: 10_000,
    placeholderData: keepPreviousData,
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
