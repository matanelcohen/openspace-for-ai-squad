'use client';

import type { SkillPhase } from '@matanelcohen/openspace-shared';
import { Plus, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  useAgentSkills,
  useSkills,
  useToggleAgentSkill,
} from '@/hooks/use-skills';

import { SkillIcon } from './skill-icon';
import { SkillPhaseBadge } from './skill-phase-badge';

interface AvailableSkillsPanelProps {
  agentId: string;
}

export function AvailableSkillsPanel({ agentId }: AvailableSkillsPanelProps) {
  const { data: allSkills, isLoading: skillsLoading } = useSkills();
  const { data: agentSkillsConfig } = useAgentSkills(agentId);
  const attachMutation = useToggleAgentSkill(agentId);
  const [search, setSearch] = useState('');

  const assignedIds = useMemo(
    () => new Set(agentSkillsConfig?.assignments.map((a) => a.skillId) ?? []),
    [agentSkillsConfig?.assignments],
  );

  const available = useMemo(() => {
    const unassigned = allSkills?.filter((s) => !assignedIds.has(s.id)) ?? [];
    if (!search.trim()) return unassigned;
    const q = search.toLowerCase();
    return unassigned.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags?.some((t) => t.toLowerCase().includes(q)),
    );
  }, [allSkills, assignedIds, search]);

  if (skillsLoading) {
    return (
      <div className="space-y-2" data-testid="available-skills-loading">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="available-skills-panel">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search available skills..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
          data-testid="available-skills-search"
        />
      </div>

      {available.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center" data-testid="no-available-skills">
          {search ? 'No matching skills found.' : 'All skills are already assigned to this agent.'}
        </p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {available.map((skill) => (
            <Card key={skill.id} className="transition-all hover:border-primary/30" data-testid={`available-skill-${skill.id}`}>
              <CardContent className="py-0 px-0">
                <div className="flex items-center gap-3 py-3 px-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <SkillIcon icon={skill.icon} className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{skill.name}</span>
                      <SkillPhaseBadge phase={skill.phase} />
                      <span className="text-xs text-muted-foreground">v{skill.version}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                  </div>

                  {skill.tags && skill.tags.length > 0 && (
                    <div className="hidden sm:flex gap-1">
                      {skill.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => attachMutation.mutate({ skillId: skill.id, mode: 'always' })}
                    disabled={attachMutation.isPending}
                    className="h-8 gap-1 text-xs shrink-0"
                    data-testid={`assign-skill-${skill.id}`}
                  >
                    <Plus className="h-3 w-3" />
                    Assign
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
