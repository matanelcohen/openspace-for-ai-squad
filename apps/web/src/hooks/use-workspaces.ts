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

const STORAGE_KEY = 'openspace:active-workspace';

/** Fetch the currently active workspace. Restores from localStorage on load. */
export function useActiveWorkspace() {
  return useQuery<Workspace>({
    queryKey: workspaceKeys.active,
    queryFn: async () => {
      const ws = await api.get<Workspace>('/api/workspaces/active');
      // Persist to localStorage for sticky selection
      if (typeof window !== 'undefined' && ws?.id) {
        localStorage.setItem(STORAGE_KEY, ws.id);
      }
      return ws;
    },
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

/** Activate a workspace by ID. Saves to localStorage for persistence. */
export function useActivateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<Workspace>(`/api/workspaces/${encodeURIComponent(id)}/activate`, {}),
    onSuccess: (workspace) => {
      if (typeof window !== 'undefined' && workspace?.id) {
        localStorage.setItem(STORAGE_KEY, workspace.id);
      }
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      queryClient.invalidateQueries({ queryKey: workspaceKeys.active });
    },
  });
}

/** Get the last active workspace ID from localStorage (for restoring on load). */
export function getStoredWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEY);
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
