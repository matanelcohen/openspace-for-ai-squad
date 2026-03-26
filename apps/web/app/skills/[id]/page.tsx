'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { AgentAvatar } from '@/components/agent-avatar';
import { SkillDetailInstructions } from '@/components/skills/skill-detail-instructions';
import { SkillDetailOverview } from '@/components/skills/skill-detail-overview';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgents } from '@/hooks/use-agents';
import { useAgentSkillsManagement, useSkillDetail } from '@/hooks/use-skills';

export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: skill, isLoading, error } = useSkillDetail(params.id);

  if (isLoading) {
    return <LoadingSpinner size="lg" message="Loading skill details..." />;
  }

  if (error || !skill) {
    return (
      <div className="space-y-4">
        <Link href="/skills">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Skill Store
          </Button>
        </Link>
        <p className="text-sm text-destructive">{error?.message ?? 'Skill not found.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link href="/skills">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Skill Store
        </Button>
      </Link>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="instructions">Instructions</TabsTrigger>
          <TabsTrigger value="agents">Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SkillDetailOverview skill={skill} />
        </TabsContent>

        <TabsContent value="instructions">
          <SkillDetailInstructions skill={skill} />
        </TabsContent>

        <TabsContent value="agents">
          <SkillAgentsList skillId={params.id} />
        </TabsContent>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SkillAgentsList({ skillId }: { skillId: string }) {
  const { data: agents = [] } = useAgents();
  const agentSkillQueries = agents
    .filter((a) => !['scribe', 'ralph'].includes(a.id))
    .map((agent) => {
      const { data } = useAgentSkillsManagement(agent.id);
      const skills = data?.skills ?? [];
      const hasSkill = skills.some((s: { id: string; enabled: boolean }) => s.id === skillId && s.enabled);
      return { agent, hasSkill, source: skills.find((s: { id: string }) => s.id === skillId)?.source };
    });

  const enabledAgents = agentSkillQueries.filter((q) => q.hasSkill);

  if (enabledAgents.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        No agents currently have this skill enabled.
      </p>
    );
  }

  return (
    <div className="space-y-3 py-2" data-testid="skill-detail-agents">
      {enabledAgents.map(({ agent, source }) => (
        <div key={agent.id} className="flex items-center gap-3 rounded-lg border p-3">
          <AgentAvatar agentId={agent.id} name={agent.name} size="sm" />
          <div className="flex-1">
            <div className="text-sm font-medium">{agent.name}</div>
            <div className="text-xs text-muted-foreground">{agent.role}</div>
          </div>
          <Badge variant="outline" className="text-xs">
            {source === 'role-match' ? 'Auto' : 'Custom'}
          </Badge>
        </div>
      ))}
    </div>
  );
}
