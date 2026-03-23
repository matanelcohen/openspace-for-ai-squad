'use client';

import type { Agent } from '@openspace/shared';

import { AgentAvatar } from '@/components/agent-avatar';
import { StatusBadge } from '@/components/status-badge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface AgentCardProps {
  agent: Agent;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Card className="transition-shadow hover:shadow-md" data-testid={`agent-card-${agent.id}`} data-realtime>
      <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-3">
        <AgentAvatar agentId={agent.id} name={agent.name} size="lg" />
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold leading-none">{agent.name}</h3>
            <StatusBadge status={agent.status} />
          </div>
          <p className="text-sm text-muted-foreground">{agent.role}</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {agent.currentTask && (
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
      </CardContent>
    </Card>
  );
}
