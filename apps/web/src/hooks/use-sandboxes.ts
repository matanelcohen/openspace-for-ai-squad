'use client';

import type { Sandbox, SandboxRuntime } from '@openspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useWsEvent } from '@/components/providers/websocket-provider';
import { api } from '@/lib/api-client';

// ── Queries ────────────────────────────────────────────────────────

export function useSandboxes() {
  const queryClient = useQueryClient();

  // Invalidate on real-time sandbox status changes
  useWsEvent('agent:status', (envelope) => {
    const payload = envelope.payload as { sandboxId?: string };
    if (payload.sandboxId) {
      queryClient.invalidateQueries({ queryKey: ['sandboxes'] });
    }
  });

  return useQuery<Sandbox[]>({
    queryKey: ['sandboxes'],
    queryFn: () => api.get<Sandbox[]>('/api/sandboxes'),
    refetchInterval: 30_000,
  });
}

export function useSandbox(id: string) {
  return useQuery<Sandbox>({
    queryKey: ['sandboxes', id],
    queryFn: () => api.get<Sandbox>(`/api/sandboxes/${id}`),
    enabled: !!id,
    refetchInterval: 10_000,
  });
}

// ── Mutations ──────────────────────────────────────────────────────

export interface CreateSandboxInput {
  name: string;
  runtime: SandboxRuntime;
}

export function useCreateSandbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateSandboxInput) => api.post<Sandbox>('/api/sandboxes', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sandboxes'] });
    },
  });
}

export function useRunCommand() {
  return useMutation({
    mutationFn: ({ sandboxId, command }: { sandboxId: string; command: string }) =>
      api.post<void>(`/api/sandboxes/${sandboxId}/exec`, { command }),
  });
}

export function useStopSandbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sandboxId: string) => api.post<Sandbox>(`/api/sandboxes/${sandboxId}/stop`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sandboxes'] });
    },
  });
}

export function useDestroySandbox() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sandboxId: string) => api.delete<void>(`/api/sandboxes/${sandboxId}`),
    onMutate: async (sandboxId) => {
      await queryClient.cancelQueries({ queryKey: ['sandboxes'] });
      const previous = queryClient.getQueryData<Sandbox[]>(['sandboxes']);
      queryClient.setQueryData<Sandbox[]>(['sandboxes'], (old) =>
        old?.filter((s) => s.id !== sandboxId),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['sandboxes'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['sandboxes'] });
    },
  });
}
