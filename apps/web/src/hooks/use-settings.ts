'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export interface HealthCheck {
  name: string;
  status: 'ok' | 'warn' | 'error';
  message?: string;
}

export interface HealthResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  uptime?: number;
  version?: string;
}

export interface SystemConfig {
  model?: string;
  fallbackModel?: string;
  failoverActive?: boolean;
  cliUrl?: string;
  agentCount?: number;
  taskCount?: number;
  skillCount?: number;
}

export interface PruneResult {
  deletedCount: number;
  message: string;
}

export function useHealthCheck() {
  return useQuery<HealthResult>({
    queryKey: ['health'],
    queryFn: async () => {
      try {
        const res = await api.get<HealthResult>('/api/health');
        return res;
      } catch {
        return {
          status: 'unhealthy' as const,
          checks: [{ name: 'API Connection', status: 'error' as const, message: 'Cannot reach API server' }],
        };
      }
    },
    refetchInterval: 60_000,
    retry: false,
  });
}

export function useSystemConfig() {
  return useQuery<SystemConfig>({
    queryKey: ['system-config'],
    queryFn: async () => {
      try {
        return await api.get<SystemConfig>('/api/config');
      } catch {
        return {};
      }
    },
  });
}

export function usePruneMessages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ maxAgeDays, maxPerChannel }: { maxAgeDays?: number; maxPerChannel?: number }) => {
      const params = new URLSearchParams();
      if (maxAgeDays) params.set('maxAgeDays', String(maxAgeDays));
      if (maxPerChannel) params.set('maxPerChannel', String(maxPerChannel));
      return api.delete<PruneResult>(`/api/chat/messages/prune?${params.toString()}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['chat'] });
    },
  });
}
