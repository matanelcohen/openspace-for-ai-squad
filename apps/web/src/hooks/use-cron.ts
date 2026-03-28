'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  scheduleHuman?: string;
  agentId?: string;
  agentName?: string;
  actionType: string;
  enabled: boolean;
  lastRunAt?: string;
  lastRunStatus?: 'success' | 'failure' | 'running';
  nextRunAt?: string;
  createdAt?: string;
  // Ceremony fields (Phase 5)
  participants?: string[];
  agenda?: string;
  type?: 'standup' | 'retro' | 'custom';
}

export interface CronExecution {
  id: string;
  jobId: string;
  jobName: string;
  status: 'success' | 'failure' | 'running';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
}

export function useCronJobs() {
  return useQuery<CronJob[]>({
    queryKey: ['cron-jobs'],
    queryFn: async () => {
      const res = await api.get<{ jobs: CronJob[] } | CronJob[]>('/api/cron');
      return Array.isArray(res) ? res : res.jobs;
    },
    refetchInterval: 30_000,
  });
}

export function useCronExecutions() {
  return useQuery<CronExecution[]>({
    queryKey: ['cron-executions'],
    queryFn: async () => {
      const res = await api.get<{ executions: unknown[] } | unknown[]>('/api/cron/executions');
      const raw = Array.isArray(res) ? res : ((res as { executions: unknown[] }).executions ?? []);
      // Map API shape to frontend shape
      return raw.map((e: unknown, i: number) => {
        const exec = e as Record<string, unknown>;
        return {
          id: (exec.id as string) ?? `exec-${i}`,
          jobId: (exec.jobId as string) ?? '',
          jobName: (exec.jobName as string) ?? (exec.jobId as string) ?? '',
          status: ((exec.status as string) ?? (exec.result as string) ?? 'success') as
            | 'success'
            | 'failure'
            | 'running',
          startedAt: (exec.startedAt as string) ?? (exec.executedAt as string) ?? '',
          completedAt: exec.completedAt as string | undefined,
          durationMs: exec.durationMs as number | undefined,
          error: exec.error as string | undefined,
        };
      });
    },
    refetchInterval: 15_000,
  });
}

export function useToggleCronJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.patch(`/api/cron/${id}`, { enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
    },
  });
}

export function useRunCronJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/api/cron/${id}/run`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
      void queryClient.invalidateQueries({ queryKey: ['cron-executions'] });
    },
  });
}

export function useCreateCronJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      schedule: string;
      agent: string;
      action: 'chat' | 'task';
      message?: string;
      channel?: string;
      title?: string;
      description?: string;
      type?: string;
      participants?: string[];
      agenda?: string;
    }) => api.post<{ job: CronJob }>('/api/cron', input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
    },
  });
}

export function useDeleteCronJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/cron/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
    },
  });
}

export function useUpdateCronJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: string;
      schedule?: string;
      agent?: string;
      action?: 'chat' | 'task';
      message?: string;
      channel?: string;
      title?: string;
      description?: string;
    }) => api.put(`/api/cron/${id}`, body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['cron-jobs'] });
    },
  });
}
