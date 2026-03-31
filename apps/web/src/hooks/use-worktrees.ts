import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export interface WorktreeInfo {
  taskId: string;
  path: string;
  branch: string;
  baseBranch: string;
  createdAt: string;
  pr?: { number: number; url: string };
}

export function useWorktrees() {
  return useQuery<WorktreeInfo[]>({
    queryKey: ['worktrees'],
    queryFn: () => api.get<WorktreeInfo[]>('/api/worktrees'),
    refetchInterval: 30_000,
  });
}

export function useWorktree(taskId: string | undefined) {
  return useQuery<WorktreeInfo>({
    queryKey: ['worktrees', taskId],
    queryFn: () => api.get<WorktreeInfo>(`/api/worktrees/${taskId}`),
    enabled: !!taskId,
    retry: false,
  });
}
