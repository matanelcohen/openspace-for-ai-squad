import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

interface AutoPilotStatus {
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

export function useAutoPilotStatus() {
  return useQuery<AutoPilotStatus>({
    queryKey: ['autopilot'],
    queryFn: () => api.get<AutoPilotStatus>('/api/autopilot/status'),
    refetchInterval: 5000,
  });
}

export function useStartAutoPilot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (opts?: { scanIntervalMs?: number; maxTasksPerScan?: number }) =>
      api.post<AutoPilotStatus>('/api/autopilot/start', opts ?? {}),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['autopilot'] });
    },
  });
}

export function useStopAutoPilot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<AutoPilotStatus>('/api/autopilot/stop', {}),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['autopilot'] });
    },
  });
}

export function useScanAutoPilot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post<ScanResult>('/api/autopilot/scan', {}),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['autopilot'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}
