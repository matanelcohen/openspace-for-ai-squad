import type { GitHubIssue, GitHubPR } from '@openspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export function useGitHubIssues() {
  return useQuery<GitHubIssue[]>({
    queryKey: ['github-issues'],
    queryFn: () => api.get<GitHubIssue[]>('/api/github/issues'),
  });
}

export function useGitHubPRs() {
  return useQuery<GitHubPR[]>({
    queryKey: ['github-prs'],
    queryFn: () => api.get<GitHubPR[]>('/api/github/prs'),
  });
}

export function useSyncIssues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api.post<{ synced: number; created: Array<{ issueNumber: number; taskId: string }> }>(
        '/api/github/issues/sync',
        {},
      ),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['github-issues'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useCreateBranch() {
  return useMutation({
    mutationFn: (input: { taskId: string; branchName?: string }) =>
      api.post<{ branch: string }>('/api/github/branch', input),
  });
}

export function useCreatePR() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { taskId: string; head: string; base?: string }) =>
      api.post<{ number: number; url: string }>('/api/github/pr', input),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['github-prs'] });
    },
  });
}
