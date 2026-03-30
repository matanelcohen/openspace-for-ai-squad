import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

interface YoloStatus {
  enabled: boolean;
  lastScanAt: string | null;
  results: { assigned: number; skipped: number };
  nextScanIn: number;
}

interface ScanDecision {
  taskId: string;
  action: 'assign' | 'skip';
  agentId?: string;
  reason: string;
}

interface ScanResult {
  decisions: ScanDecision[];
  assigned: number;
  skipped: number;
  timestamp: string;
}

export function useYoloStatus() {
  return useQuery<YoloStatus>({
    queryKey: ['yolo'],
    queryFn: () => api.get<YoloStatus>('/api/yolo/status'),
    refetchInterval: 5000,
  });
}

export function useStartYolo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts?: { scanIntervalMs?: number; maxTasksPerScan?: number }) =>
      api.post<YoloStatus>('/api/yolo/start', opts ?? {}),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['yolo'] });
    },
  });
}

export function useStopYolo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<YoloStatus>('/api/yolo/stop', {}),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['yolo'] });
    },
  });
}

export function useScanYolo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<ScanResult>('/api/yolo/scan', {}),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['yolo'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
