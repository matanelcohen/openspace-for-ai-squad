'use client';

import type { Agent } from '@openspace/shared';
import { Puzzle } from 'lucide-react';
import { useState } from 'react';

import { AgentAvatar } from '@/components/agent-avatar';
import { AgentSkillDialog } from '@/components/skills/agent-skill-dialog';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { AgentWorkStatus } from '@/hooks/use-agent-status';
import { useAgentSkillsManagement } from '@/hooks/use-skills';

interface AgentCardProps {
  agent: Agent;
  workStatus?: AgentWorkStatus;
}

export function AgentCard({ agent, workStatus }: AgentCardProps) {
  const isWorking = !!workStatus?.activeTask;
  const queueLength = workStatus?.queueLength ?? 0;
  const [skillsOpen, setSkillsOpen] = useState(false);

  const { data: skillsData } = useAgentSkillsManagement(agent.id);
  const enabledCount = skillsData?.skills.filter((s) => s.enabled).length ?? 0;

  return (
    <Card
      className="transition-shadow hover:shadow-md"
      data-testid={`agent-card-${agent.id}`}
      data-realtime
    >
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
        <div className="relative">
          <AgentAvatar agentId={agent.id} name={agent.name} size="lg" />
          {isWorking && (
            <span
              className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-background animate-pulse"
              title="Working"
            />
          )}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold leading-none">{agent.name}</h3>
            <StatusBadge status={agent.status} />
          </div>
          <p className="text-sm text-muted-foreground">{agent.role}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isWorking && workStatus?.activeTask && (
          <div className="rounded-md bg-green-500/10 border border-green-500/20 px-3 py-2">
            <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Working on
            </p>
            <p className="text-sm truncate" title={workStatus.activeTask.title}>
              {workStatus.activeTask.title}
            </p>
          </div>
        )}
        {!isWorking && queueLength === 0 && (
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              ⏸️ Idle
            </p>
          </div>
        )}
        {queueLength > 0 && (
          <div className="rounded-md bg-blue-500/10 border border-blue-500/20 px-3 py-2">
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 flex items-center gap-1">
              📋 Queue: {queueLength} task{queueLength !== 1 ? 's' : ''}
            </p>
          </div>
        )}
        {agent.currentTask && !isWorking && (
          <div className="rounded-md bg-muted/50 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Current task</p>
            <p className="text-sm">{agent.currentTask}</p>
          </div>
        )}
        {agent.expertise.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {agent.expertise.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        {/* Skills badge */}
        <button
          type="button"
          onClick={() => setSkillsOpen(true)}
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground w-fit"
          data-testid={`agent-skills-badge-${agent.id}`}
        >
          <Puzzle className="h-3.5 w-3.5" />
          {enabledCount} skill{enabledCount !== 1 ? 's' : ''}
        </button>
      </CardContent>

      <AgentSkillDialog
        agentId={agent.id}
        agentName={agent.name}
        agentRole={agent.role}
        open={skillsOpen}
        onOpenChange={setSkillsOpen}
      />
    </Card>
  );
}
