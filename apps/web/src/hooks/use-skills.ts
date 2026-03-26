'use client';

import type { SkillManifest, SkillPhase, SkillRegistryEntry } from '@openspace/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api-client';

// ── API response types ───────────────────────────────────────────

export interface SkillSummary {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  icon?: string;
  tags?: string[];
  phase: SkillPhase;
  activeAgentCount: number;
}

export interface SkillDetail extends SkillRegistryEntry {
  manifest: SkillManifest & {
    sourcePath?: string;
    resolvedDependencies?: Record<string, string>;
    toolAvailability?: Record<string, boolean>;
  };
}

export interface AgentSkillAssignment {
  skillId: string;
  enabled: boolean;
  priority: number;
  config?: Record<string, unknown>;
}

export interface AgentSkillsConfig {
  agentId: string;
  agentName: string;
  agentRole: string;
  assignments: AgentSkillAssignment[];
  activeOnCurrentTask: string[];
}

// ── Hooks ────────────────────────────────────────────────────────

export function useSkills(filters?: { search?: string; tag?: string; phase?: SkillPhase }) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.tag) params.set('tag', filters.tag);
  if (filters?.phase) params.set('phase', filters.phase);
  const query = params.toString();

  return useQuery<SkillSummary[]>({
    queryKey: ['skills', filters],
    queryFn: () => api.get<SkillSummary[]>(`/api/skills${query ? `?${query}` : ''}`),
    refetchInterval: 30_000,
  });
}

export function useSkillDetail(skillId: string) {
  return useQuery<SkillDetail>({
    queryKey: ['skills', skillId],
    queryFn: () => api.get<SkillDetail>(`/api/skills/${skillId}`),
    enabled: !!skillId,
  });
}

export function useAgentSkills(agentId: string) {
  return useQuery<AgentSkillsConfig>({
    queryKey: ['agent-skills', agentId],
    queryFn: () => api.get<AgentSkillsConfig>(`/api/agents/${agentId}/skills`),
    enabled: !!agentId,
  });
}

export function useToggleAgentSkill(agentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillId, enabled }: { skillId: string; enabled: boolean }) =>
      api.put(`/api/agents/${agentId}/skills/${skillId}`, { enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-skills', agentId] });
    },
  });
}

export function useReorderAgentSkills(agentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedSkillIds: string[]) =>
      api.put(`/api/agents/${agentId}/skills/order`, { skillIds: orderedSkillIds }),
    onMutate: async (orderedSkillIds) => {
      await queryClient.cancelQueries({ queryKey: ['agent-skills', agentId] });
      const previous = queryClient.getQueryData<AgentSkillsConfig>(['agent-skills', agentId]);
      if (previous) {
        const reordered = orderedSkillIds
          .map((id, idx) => {
            const existing = previous.assignments.find((a) => a.skillId === id);
            return existing ? { ...existing, priority: idx } : null;
          })
          .filter(Boolean) as AgentSkillAssignment[];
        queryClient.setQueryData(['agent-skills', agentId], {
          ...previous,
          assignments: reordered,
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['agent-skills', agentId], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-skills', agentId] });
    },
  });
}

export function useAllSkillTags() {
  const { data: skills } = useSkills();
  const tags = new Set<string>();
  skills?.forEach((s) => s.tags?.forEach((t) => tags.add(t)));
  return Array.from(tags).sort();
}

export function useBulkToggleAgentSkills(agentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillIds, enabled }: { skillIds: string[]; enabled: boolean }) =>
      api.put(`/api/agents/${agentId}/skills/bulk-toggle`, { skillIds, enabled }),
    onMutate: async ({ skillIds, enabled }) => {
      await queryClient.cancelQueries({ queryKey: ['agent-skills', agentId] });
      const previous = queryClient.getQueryData<AgentSkillsConfig>(['agent-skills', agentId]);
      if (previous) {
        const idSet = new Set(skillIds);
        queryClient.setQueryData(['agent-skills', agentId], {
          ...previous,
          assignments: previous.assignments.map((a) =>
            idSet.has(a.skillId) ? { ...a, enabled } : a,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['agent-skills', agentId], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-skills', agentId] });
    },
  });
}

export function useUpdateAgentSkillConfig(agentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillId, config }: { skillId: string; config: Record<string, unknown> }) =>
      api.put(`/api/agents/${agentId}/skills/${skillId}/config`, { config }),
    onMutate: async ({ skillId, config }) => {
      await queryClient.cancelQueries({ queryKey: ['agent-skills', agentId] });
      const previous = queryClient.getQueryData<AgentSkillsConfig>(['agent-skills', agentId]);
      if (previous) {
        queryClient.setQueryData(['agent-skills', agentId], {
          ...previous,
          assignments: previous.assignments.map((a) =>
            a.skillId === skillId ? { ...a, config } : a,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['agent-skills', agentId], context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-skills', agentId] });
    },
  });
}

export function useCreateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (manifest: SkillManifest) => api.post<SkillSummary>('/api/skills', manifest),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}
