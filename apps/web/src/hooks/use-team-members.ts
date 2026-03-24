import type { TeamMember, TeamMemberRank, TeamMemberStatus } from '@openspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

export function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ['team-members'],
    queryFn: () => api.get<TeamMember[]>('/api/team-members'),
    refetchInterval: 300_000,
  });
}

export function useTeamMember(id: string) {
  return useQuery<TeamMember>({
    queryKey: ['team-members', id],
    queryFn: () => api.get<TeamMember>(`/api/team-members/${id}`),
    enabled: !!id,
  });
}

export interface CreateTeamMemberInput {
  name: string;
  email: string;
  role: string;
  department: string;
  skills: string[];
  rank: TeamMemberRank;
  status: TeamMemberStatus;
}

export function useCreateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTeamMemberInput) => api.post<TeamMember>('/api/team-members', input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['team-members'] });
      const previous = queryClient.getQueryData<TeamMember[]>(['team-members']);
      const optimistic: TeamMember = {
        id: `temp-${Date.now()}`,
        ...input,
        joinedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      queryClient.setQueryData<TeamMember[]>(['team-members'], (old) => [
        ...(old ?? []),
        optimistic,
      ]);
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['team-members'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
  });
}

export interface UpdateTeamMemberInput {
  memberId: string;
  name: string;
  email: string;
  role: string;
  department: string;
  skills: string[];
  rank: TeamMemberRank;
  status: TeamMemberStatus;
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, ...body }: UpdateTeamMemberInput) =>
      api.put<TeamMember>(`/api/team-members/${memberId}`, body),
    onMutate: async ({ memberId, ...body }) => {
      await queryClient.cancelQueries({ queryKey: ['team-members'] });
      const previous = queryClient.getQueryData<TeamMember[]>(['team-members']);
      queryClient.setQueryData<TeamMember[]>(['team-members'], (old) =>
        old?.map((m) =>
          m.id === memberId ? { ...m, ...body, updatedAt: new Date().toISOString() } : m,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['team-members'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
  });
}

export function useUpdateTeamMemberRank() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, rank }: { memberId: string; rank: TeamMemberRank }) =>
      api.patch<TeamMember>(`/api/team-members/${memberId}/rank`, { rank }),
    onMutate: async ({ memberId, rank }) => {
      await queryClient.cancelQueries({ queryKey: ['team-members'] });
      const previousList = queryClient.getQueryData<TeamMember[]>(['team-members']);
      const previousDetail = queryClient.getQueryData<TeamMember>(['team-members', memberId]);
      queryClient.setQueryData<TeamMember[]>(['team-members'], (old) =>
        old?.map((m) =>
          m.id === memberId ? { ...m, rank, updatedAt: new Date().toISOString() } : m,
        ),
      );
      queryClient.setQueryData<TeamMember>(['team-members', memberId], (old) =>
        old ? { ...old, rank, updatedAt: new Date().toISOString() } : old,
      );
      return { previousList, previousDetail };
    },
    onError: (_err, { memberId }, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(['team-members'], context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(['team-members', memberId], context.previousDetail);
      }
    },
    onSettled: (_data, _err, { memberId }) => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['team-members', memberId] });
    },
  });
}

export function useUpdateTeamMemberStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, status }: { memberId: string; status: TeamMemberStatus }) =>
      api.patch<TeamMember>(`/api/team-members/${memberId}/status`, { status }),
    onMutate: async ({ memberId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['team-members'] });
      const previousList = queryClient.getQueryData<TeamMember[]>(['team-members']);
      const previousDetail = queryClient.getQueryData<TeamMember>(['team-members', memberId]);
      queryClient.setQueryData<TeamMember[]>(['team-members'], (old) =>
        old?.map((m) =>
          m.id === memberId ? { ...m, status, updatedAt: new Date().toISOString() } : m,
        ),
      );
      queryClient.setQueryData<TeamMember>(['team-members', memberId], (old) =>
        old ? { ...old, status, updatedAt: new Date().toISOString() } : old,
      );
      return { previousList, previousDetail };
    },
    onError: (_err, { memberId }, context) => {
      if (context?.previousList) {
        queryClient.setQueryData(['team-members'], context.previousList);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(['team-members', memberId], context.previousDetail);
      }
    },
    onSettled: (_data, _err, { memberId }) => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
      queryClient.invalidateQueries({ queryKey: ['team-members', memberId] });
    },
  });
}

export function useDeleteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => api.delete<void>(`/api/team-members/${memberId}`),
    onMutate: async (memberId) => {
      await queryClient.cancelQueries({ queryKey: ['team-members'] });
      const previous = queryClient.getQueryData<TeamMember[]>(['team-members']);
      queryClient.setQueryData<TeamMember[]>(['team-members'], (old) =>
        old?.filter((m) => m.id !== memberId),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['team-members'], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] });
    },
  });
}
