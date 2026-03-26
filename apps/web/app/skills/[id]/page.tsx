'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { SkillDetailInstructions } from '@/components/skills/skill-detail-instructions';
import { SkillDetailOverview } from '@/components/skills/skill-detail-overview';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSkillDetail } from '@/hooks/use-skills';

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
          <TabsTrigger value="agents">
            Agents (
            {(() => {
              const agents = skill.activeAgents;
              if (agents instanceof Set) return agents.size;
              if (Array.isArray(agents)) return (agents as unknown[]).length;
              return 0;
            })()}
            )
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SkillDetailOverview skill={skill} />
        </TabsContent>

        <TabsContent value="instructions">
          <SkillDetailInstructions skill={skill} />
        </TabsContent>

        <TabsContent value="agents">
          <div className="space-y-4" data-testid="skill-detail-agents">
            {(() => {
              const agents =
                skill.activeAgents instanceof Set
                  ? [...skill.activeAgents]
                  : Array.isArray(skill.activeAgents)
                    ? skill.activeAgents
                    : [];
              if (agents.length === 0) {
                return (
                  <p className="text-sm text-muted-foreground">
                    No agents are currently using this skill.
                  </p>
                );
              }
              return (
                <ul className="space-y-2">
                  {agents.map((agentId) => (
                    <li key={String(agentId)}>
                      <Link
                        href={`/agents/${String(agentId)}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {String(agentId)}
                      </Link>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
