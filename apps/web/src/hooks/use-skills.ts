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
  matchedRoles?: string[];
  requiredBins?: string[];
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

/** Shape returned by GET /api/agents/:id/skills */
export interface AgentSkillEntry {
  id: string;
  name: string;
  description: string;
  tags: string[];
  enabled: boolean;
  source: 'role-match' | 'manual';
  matchedByRole: boolean;
}

export interface AgentSkillsResponse {
  agentId: string;
  role: string;
  skills: AgentSkillEntry[];
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
    queryFn: async () => {
      const res = await api.get<{ skills: SkillSummary[] } | SkillSummary[]>(
        `/api/skills${query ? `?${query}` : ''}`,
      );
      return Array.isArray(res) ? res : res.skills;
    },
    refetchInterval: 30_000,
  });
}

export function useSkillDetail(skillId: string) {
  return useQuery<SkillDetail>({
    queryKey: ['skills', skillId],
    queryFn: async () => {
      const res = await api.get<Record<string, unknown>>(`/api/skills/${skillId}`);
      // API returns flat — wrap in manifest if needed
      if (res && !res.manifest) {
        return { ...res, manifest: res } as unknown as SkillDetail;
      }
      return res as unknown as SkillDetail;
    },
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

export function useAgentSkillsManagement(agentId: string) {
  return useQuery<AgentSkillsResponse>({
    queryKey: ['agent-skills-mgmt', agentId],
    queryFn: () => api.get<AgentSkillsResponse>(`/api/agents/${agentId}/skills`),
    enabled: !!agentId,
    refetchInterval: 30_000,
  });
}

export function useToggleAgentSkill(agentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillId, enabled }: { skillId: string; enabled: boolean }) =>
      api.patch(`/api/agents/${agentId}/skills`, { skillId, enabled }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['agent-skills', agentId] });
      void queryClient.invalidateQueries({ queryKey: ['agent-skills-mgmt', agentId] });
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

export interface CreateSkillPayload {
  name: string;
  description: string;
  tags: string[];
  agentMatch: { roles: string[] };
  requires: { bins: string[]; env: string[] };
  instructions: string;
}

export function useCreateSkill() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSkillPayload) =>
      api.post<SkillSummary & { id?: string }>('/api/skills', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}

// ── GitHub import types ──────────────────────────────────────────

export interface GitHubSkillSource {
  owner: string;
  repo: string;
  path: string;
}

export interface ScannedGitHubSkill {
  id: string;
  name: string;
  description: string;
  path: string;
}

export interface ScanGitHubSkillsResponse {
  source: GitHubSkillSource;
  skills: ScannedGitHubSkill[];
}

export interface ImportSkillsResponse {
  imported: Array<{ id: string; name: string }>;
  errors: Array<{ id: string; error: string }>;
}

// ── GitHub import hooks ──────────────────────────────────────────

export function useScanGitHubSkills() {
  return useMutation({
    mutationFn: (url: string) =>
      api.post<ScanGitHubSkillsResponse>('/api/skills/import/scan', { url }),
  });
}

export function useImportSkills() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      source: { owner: string; repo: string; ref?: string };
      skills: Array<{ id: string; path: string }>;
    }) => api.post<ImportSkillsResponse>('/api/skills/import', payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['skills'] });
    },
  });
}
