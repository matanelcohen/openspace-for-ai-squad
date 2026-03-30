'use client';

import type { WorkflowDefinition } from '@matanelcohen/openspace-shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

// ── List Workflows ──────────────────────────────────────────────

interface UseWorkflowsReturn {
  workflows: WorkflowDefinition[];
  isLoading: boolean;
  error: Error | null;
}

export function useWorkflows(): UseWorkflowsReturn {
  const { data, isLoading, error } = useQuery<WorkflowDefinition[]>({
    queryKey: ['workflows'],
    queryFn: () => api.get<WorkflowDefinition[]>('/api/workflows'),
    refetchInterval: 30_000,
  });

  return {
    workflows: data ?? [],
    isLoading,
    error: error as Error | null,
  };
}

// ── Create Workflow ─────────────────────────────────────────────

export function useCreateWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (definition: WorkflowDefinition) =>
      api.post<WorkflowDefinition>('/api/workflows', definition),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

// ── Delete Workflow ─────────────────────────────────────────────

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workflowId: string) =>
      api.delete<void>(`/api/workflows/${workflowId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
    },
  });
}

// ── Start Execution ─────────────────────────────────────────────

interface StartExecutionResult {
  executionId: string;
}

export function useStartExecution() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (workflowId: string) =>
      api.post<StartExecutionResult>(`/api/workflows/${workflowId}/execute`, {}),
    onSuccess: (_data, workflowId) => {
      queryClient.invalidateQueries({ queryKey: ['workflow', workflowId] });
    },
  });
}
