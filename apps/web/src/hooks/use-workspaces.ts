import type { Workspace } from '@openspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

/** Centralised query-key factory for workspace queries. */
export const workspaceKeys = {
  all: ['workspaces'] as const,
  active: ['workspaces', 'active'] as const,
};

/** How long workspace data stays fresh before a background refetch (60 s). */
const WORKSPACE_STALE_TIME = 60_000;

// ── Query hooks ─────────────────────────────────────────────────────

/** Fetch all workspaces. */
export function useWorkspaces() {
  return useQuery<Workspace[]>({
    queryKey: workspaceKeys.all,
    queryFn: () => api.get<Workspace[]>('/api/workspaces'),
    staleTime: WORKSPACE_STALE_TIME,
  });
}

/** Fetch the currently active workspace. */
export function useActiveWorkspace() {
  return useQuery<Workspace>({
    queryKey: workspaceKeys.active,
    queryFn: () => api.get<Workspace>('/api/workspaces/active'),
    staleTime: WORKSPACE_STALE_TIME,
  });
}

// ── Mutation hooks ──────────────────────────────────────────────────

/** Create a new workspace. */
export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name: string; projectDir: string; icon?: string }) =>
      api.post<Workspace>('/api/workspaces', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.active });
    },
  });
}

/** Activate a workspace by ID. */
export function useActivateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<Workspace>(`/api/workspaces/${encodeURIComponent(id)}/activate`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.active });
    },
  });
}

/** Delete a workspace by ID. */
export function useDeleteWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean }>(`/api/workspaces/${encodeURIComponent(id)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.active });
    },
  });
}
