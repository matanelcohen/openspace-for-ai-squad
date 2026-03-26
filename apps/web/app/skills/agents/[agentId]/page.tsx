'use client';

import { ArrowLeft, Bot } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AgentSkillList } from '@/components/skills/agent-skill-list';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useAgentSkills } from '@/hooks/use-skills';

export default function AgentSkillConfigPage() {
  const params = useParams<{ agentId: string }>();
  const { data: agentSkillsConfig, isLoading } = useAgentSkills(params.agentId);

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading agent skill configuration..." />;
  }

  return (
    <div className="space-y-6">
      <Link href="/skills">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Skill Store
        </Button>
      </Link>

      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {agentSkillsConfig?.agentName ?? 'Agent'} Skills
          </h1>
          <p className="text-sm text-muted-foreground">
            {agentSkillsConfig?.agentRole
              ? `${agentSkillsConfig.agentRole} · `
              : ''}
            Configure which skills this agent uses and their priority order.
          </p>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
          <span>
            Skills highlighted with a green ring are currently active on the agent&apos;s task. Drag to reorder priority.
          </span>
        </div>
      </div>

      <AgentSkillList agentId={params.agentId} />
    </div>
  );
}
