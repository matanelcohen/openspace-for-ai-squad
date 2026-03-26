'use client';

import { Puzzle, Sparkles, User } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useAgentSkillsManagement, useToggleAgentSkill } from '@/hooks/use-skills';
import { cn } from '@/lib/utils';

import { SkillIcon } from './skill-icon';

interface AgentSkillDialogProps {
  agentId: string;
  agentName: string;
  agentRole: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

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
        s.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [data?.skills, search]);

  const enabledCount = data?.skills.filter((s) => s.enabled).length ?? 0;

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
            {agentRole} · {enabledCount} skill{enabledCount !== 1 ? 's' : ''} enabled
          </DialogDescription>
        </DialogHeader>

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

          {filteredSkills.map((skill) => (
            <div
              key={skill.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                skill.enabled
                  ? 'bg-background border-border'
                  : 'bg-muted/30 border-transparent opacity-70',
              )}
              data-testid={`agent-skill-item-${skill.id}`}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <SkillIcon icon={undefined} className="h-4 w-4" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate">{skill.name}</span>
                  {skill.source === 'role-match' && skill.matchedByRole && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5 shrink-0">
                      <Sparkles className="h-2.5 w-2.5" />
                      Auto
                    </Badge>
                  )}
                  {skill.source === 'manual' && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5 shrink-0">
                      <User className="h-2.5 w-2.5" />
                      Custom
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{skill.description}</p>
              </div>

              <Switch
                checked={skill.enabled}
                onCheckedChange={(checked) =>
                  toggleMutation.mutate({ skillId: skill.id, enabled: checked })
                }
                disabled={toggleMutation.isPending}
                aria-label={`Toggle ${skill.name}`}
                data-testid={`agent-skill-toggle-${skill.id}`}
              />
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
