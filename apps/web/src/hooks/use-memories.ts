import type { Memory, MemorySettings } from '@openspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export function useMemories() {
  return useQuery<Memory[]>({
    queryKey: ['memories'],
    queryFn: () => api.get<Memory[]>('/api/memories'),
  });
}

export function useMemorySettings() {
  return useQuery<MemorySettings>({
    queryKey: ['memory-settings'],
    queryFn: () => api.get<MemorySettings>('/api/memories/settings'),
  });
}

export function useUpdateMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content }: { id: string; content: string }) =>
      api.patch<Memory>(`/api/memories/${id}`, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memories'] });
    },
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/api/memories/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memories'] });
    },
  });
}

export function useToggleMemoryGlobal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (enabled: boolean) =>
      api.patch<MemorySettings>('/api/memories/settings', { globalEnabled: enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memory-settings'] });
    },
  });
}

export function useToggleMemoryForAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ agentId, enabled }: { agentId: string; enabled: boolean }) =>
      api.patch<MemorySettings>('/api/memories/settings', {
        agentEnabled: { [agentId]: enabled },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memory-settings'] });
    },
  });
}
