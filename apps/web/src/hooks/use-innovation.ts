import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export function useInnovationStatus() {
  return useQuery({
    queryKey: ['innovation-status'],
    queryFn: () => api.get<{ enabled: boolean; lastScan: string | null; suggestionsCreated: number }>('/api/innovation/status'),
    refetchInterval: 10_000,
  });
}

export function useStartInnovation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/api/innovation/start', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['innovation-status'] }),
  });
}

export function useStopInnovation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/api/innovation/stop', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['innovation-status'] }),
  });
}

export function useScanInnovation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/api/innovation/scan', {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['innovation-status'] });
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
