import type { ConfidenceThreshold, EscalationChain } from '@matanelcohen/openspace-shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export interface ThresholdConfig {
  thresholds: ConfidenceThreshold[];
  chains: EscalationChain[];
}

export function useThresholdConfig() {
  return useQuery<ThresholdConfig>({
    queryKey: ['escalation-config'],
    queryFn: () => api.get<ThresholdConfig>('/api/escalations/config'),
  });
}

export function useUpdateThresholds() {
  const queryClient = useQueryClient();

  return useMutation<ThresholdConfig, Error, ConfidenceThreshold[]>({
    mutationFn: (thresholds) =>
      api.put<ThresholdConfig>('/api/escalations/config/thresholds', { thresholds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-config'] });
    },
  });
}

export function useUpdateChains() {
  const queryClient = useQueryClient();

  return useMutation<ThresholdConfig, Error, EscalationChain[]>({
    mutationFn: (chains) =>
      api.put<ThresholdConfig>('/api/escalations/config/chains', { chains }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escalation-config'] });
    },
  });
}
