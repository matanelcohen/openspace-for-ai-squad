'use client';

import { Puzzle } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useAgentSkillsManagement, useToggleAgentSkill, type AgentSkillEntry } from '@/hooks/use-skills';
import { cn } from '@/lib/utils';

import { SkillIcon } from './skill-icon';

interface AgentSkillDialogProps {
  agentId: string;
  agentName: string;
  agentRole: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SkillMode = 'auto' | 'always' | 'never';

const MODE_CONFIG: Record<SkillMode, { label: string; badge: string; color: string }> = {
  auto: { label: 'Auto', badge: '🟢 Auto', color: 'bg-background border-border' },
  always: { label: 'Always', badge: '✅ Always', color: 'bg-green-500/5 border-green-500/30' },
  never: { label: 'Never', badge: '❌ Never', color: 'bg-muted/30 border-transparent opacity-60' },
};

const MODE_CYCLE: SkillMode[] = ['auto', 'always', 'never'];

export function AgentSkillDialog({
  agentId,
  agentName,
  agentRole,
  open,
  onOpenChange,
}: AgentSkillDialogProps) {
  const { data, isLoading } = useAgentSkillsManagement(agentId);
  const toggleMutation = useToggleAgentSkill(agentId);
  const [search, setSearch] = useState('');

  const filteredSkills = useMemo(() => {
    if (!data?.skills) return [];
    if (!search) return data.skills;
    const q = search.toLowerCase();
    return data.skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        (s.tags ?? []).some((t) => t.toLowerCase().includes(q)),
    );
  }, [data?.skills, search]);

  const alwaysCount = data?.skills?.filter((s) => s.mode === 'always').length ?? 0;
  const neverCount = data?.skills?.filter((s) => s.mode === 'never').length ?? 0;
  const totalCount = data?.skills?.length ?? 0;

  const cycleMode = (current: SkillMode) => {
    const idx = MODE_CYCLE.indexOf(current);
    return MODE_CYCLE[(idx + 1) % MODE_CYCLE.length]!;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[85vh] flex flex-col"
        data-testid="agent-skill-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Puzzle className="h-5 w-5" />
            Skills — {agentName}
          </DialogTitle>
          <DialogDescription>
            {agentRole} · {totalCount} skills · {alwaysCount} pinned{neverCount > 0 ? ` · ${neverCount} excluded` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-2.5 text-xs text-muted-foreground space-y-1">
          <p><strong>🟢 Auto</strong> — matched by task content + role (SDK-style)</p>
          <p><strong>✅ Always</strong> — always injected for this agent</p>
          <p><strong>❌ Never</strong> — excluded even if auto-matched</p>
        </div>

        <Input
          placeholder="Search skills…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 text-sm"
          data-testid="agent-skill-search"
        />

        <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1" data-testid="agent-skill-list">
          {isLoading && (
            <div className="space-y-2 py-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          )}

          {!isLoading && filteredSkills.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {search ? 'No skills match your search.' : 'No skills available.'}
            </p>
          )}

          {filteredSkills.map((skill) => {
            const mode = skill.mode ?? 'auto';
            const config = MODE_CONFIG[mode];

            return (
              <div
                key={skill.id}
                className={cn(
                  'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  config.color,
                )}
                data-testid={`agent-skill-item-${skill.id}`}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <SkillIcon icon={undefined} className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{skill.name}</span>
                    {skill.domain && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                        {skill.domain}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs h-7 px-2"
                  onClick={() =>
                    toggleMutation.mutate({ skillId: skill.id, mode: cycleMode(mode) })
                  }
                  disabled={toggleMutation.isPending}
                  data-testid={`agent-skill-toggle-${skill.id}`}
                >
                  {config.badge}
                </Button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
