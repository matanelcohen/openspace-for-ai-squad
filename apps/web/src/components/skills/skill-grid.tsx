'use client';

import { Puzzle } from 'lucide-react';
import { useMemo } from 'react';

import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useAgents } from '@/hooks/use-agents';
import { type SkillSummary, useAgentSkillsManagement } from '@/hooks/use-skills';

import { SkillCard } from './skill-card';

interface SkillGridProps {
  skills?: SkillSummary[];
  isLoading: boolean;
}

/** Fetch skill assignments for one agent and return enabled skill IDs. */
function useEnabledSkillIds(agentId: string) {
  const { data } = useAgentSkillsManagement(agentId);
  return useMemo(
    () => new Set(data?.skills.filter((s) => s.enabled).map((s) => s.id) ?? []),
    [data],
  );
}

/** Hook that maps skill IDs → agents that have them enabled. */
function useSkillAgentMap(agentIds: string[]) {
  // React hooks must always be called in the same order, so we call 4 fixed hooks
  const e0 = useEnabledSkillIds(agentIds[0] ?? '');
  const e1 = useEnabledSkillIds(agentIds[1] ?? '');
  const e2 = useEnabledSkillIds(agentIds[2] ?? '');
  const e3 = useEnabledSkillIds(agentIds[3] ?? '');

  return useMemo(() => {
    const entries = [
      { idx: 0, set: e0 },
      { idx: 1, set: e1 },
      { idx: 2, set: e2 },
      { idx: 3, set: e3 },
    ].filter(({ idx }) => idx < agentIds.length);

    const map = new Map<string, number[]>();
    for (const { idx, set } of entries) {
      for (const skillId of set) {
        const arr = map.get(skillId) ?? [];
        arr.push(idx);
        map.set(skillId, arr);
      }
    }
    return map;
  }, [agentIds, e0, e1, e2, e3]);
}

export function SkillGrid({ skills, isLoading }: SkillGridProps) {
  const { data: agents } = useAgents();
  const agentIds = useMemo(() => (agents ?? []).slice(0, 4).map((a) => a.id), [agents]);
  const agentList = useMemo(() => (agents ?? []).slice(0, 4), [agents]);
  const skillAgentMap = useSkillAgentMap(agentIds);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="skill-grid-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    );
  }

  if (!skills?.length) {
    return (
      <EmptyState
        icon={Puzzle}
        title="No skills found"
        description="No skills match your current filters. Try adjusting your search or browse all available skills."
        data-testid="skill-grid-empty"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="skill-grid">
      {skills.map((skill) => {
        const agentIndices = skillAgentMap.get(skill.id) ?? [];
        const enabledAgents = agentIndices.map((idx) => agentList[idx]).filter(Boolean);
        return (
          <SkillCard
            key={skill.id}
            skill={skill}
            enabledAgents={enabledAgents.map((a) => ({ id: a.id, name: a.name }))}
          />
        );
      })}
    </div>
  );
}
