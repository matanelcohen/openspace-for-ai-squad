import type { Task, TaskPriority, TaskStatus } from '@matanelcohen/openspace-shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export function useTasks() {
  return useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: () => api.get<Task[]>('/api/tasks'),
    refetchInterval: 300_000, // 5 min fallback — real-time updates via WebSocket
  });
}

export function useTask(id: string) {
  return useQuery<Task>({
    queryKey: ['tasks', id],
    queryFn: () => api.get<Task>(`/api/tasks/${id}`),
    enabled: !!id,
  });
}

export function useSubtasks(parentId: string) {
  return useQuery<Task[]>({
    queryKey: ['tasks', parentId, 'subtasks'],
    queryFn: () => api.get<Task[]>(`/api/tasks/${parentId}/subtasks`),
    enabled: !!parentId,
    refetchInterval: 15_000, // Poll every 15s for subtask progress
  });
}

export function useUpdateTaskStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      api.patch<Task>(`/api/tasks/${taskId}/status`, { status }),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData<Task[]>(['tasks'], (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, status } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export interface CreateTaskInput {
  title: string;
  description: string;
  assignee: string | null;
  priority: TaskPriority;
  labels: string[];
  dependencies?: string[];
}

export function useCreateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => api.post<Task>('/api/tasks', input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks']);
      const optimistic: Task = {
        id: `temp-${Date.now()}`,
        title: input.title,
        description: input.description,
        status: 'pending',
        priority: input.priority,
        assignee: input.assignee,
        assigneeType: 'agent', // Default to agent for now
        labels: input.labels,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sortIndex: 0,
      };
      queryClient.setQueryData<Task[]>(['tasks'], (old) => [...(old ?? []), optimistic]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export interface UpdateTaskInput {
  taskId: string;
  title: string;
  description: string;
  assignee: string | null;
  priority: TaskPriority;
  labels: string[];
  dependencies?: string[];
}

export function useUpdateTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, ...body }: UpdateTaskInput) =>
      api.put<Task>(`/api/tasks/${taskId}`, body),
    onMutate: async ({ taskId, ...body }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData<Task[]>(['tasks'], (old) =>
        old?.map((t) =>
          t.id === taskId ? { ...t, ...body, updatedAt: new Date().toISOString() } : t,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useUpdateTaskPriority() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, sortIndex }: { taskId: string; sortIndex: number }) =>
      api.patch<Task>(`/api/tasks/${taskId}/priority`, { sortIndex }),
    onMutate: async ({ taskId, sortIndex }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData<Task[]>(['tasks'], (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, sortIndex } : t)),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useApproveTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => api.patch<Task>(`/api/tasks/${taskId}/approve`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useRejectTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => api.patch<Task>(`/api/tasks/${taskId}/reject`, {}),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData<Task[]>(['tasks'], (old) => old?.filter((t) => t.id !== taskId));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (taskId: string) => api.delete(`/api/tasks/${taskId}`),
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData<Task[]>(['tasks'], (old) => old?.filter((t) => t.id !== taskId));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useEnqueueTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, agentId }: { taskId: string; agentId: string }) =>
      api.post<{ success: boolean; taskId: string; agentId: string }>(
        `/api/tasks/${taskId}/enqueue`,
        { agentId },
      ),
    onMutate: async ({ taskId, agentId }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      const previous = queryClient.getQueryData<Task[]>(['tasks']);
      queryClient.setQueryData<Task[]>(['tasks'], (old) =>
        old?.map((t) =>
          t.id === taskId ? { ...t, assignee: agentId, status: 'in-progress' as TaskStatus } : t,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['tasks'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
  });
}

export function useTaskDependencyGraph(taskId: string) {
  return useQuery<Task[]>({
    queryKey: ['tasks', taskId, 'dependency-graph'],
    queryFn: () => api.get<Task[]>(`/api/tasks/${taskId}/dependency-graph`),
    enabled: !!taskId,
  });
}
