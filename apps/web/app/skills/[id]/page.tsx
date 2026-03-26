'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { SkillDetailDependencies } from '@/components/skills/skill-detail-dependencies';
import { SkillDetailOverview } from '@/components/skills/skill-detail-overview';
import { SkillDetailPrompts } from '@/components/skills/skill-detail-prompts';
import { SkillDetailTools } from '@/components/skills/skill-detail-tools';
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
        <p className="text-sm text-destructive">
          {error?.message ?? 'Skill not found.'}
        </p>
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
          <TabsTrigger value="tools">
            Tools ({skill.manifest.tools.length})
          </TabsTrigger>
          <TabsTrigger value="prompts">
            Prompts ({skill.manifest.prompts.length})
          </TabsTrigger>
          <TabsTrigger value="dependencies">
            Dependencies ({skill.manifest.dependencies?.length ?? 0})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <SkillDetailOverview skill={skill} />
        </TabsContent>

        <TabsContent value="tools">
          <SkillDetailTools skill={skill} />
        </TabsContent>

        <TabsContent value="prompts">
          <SkillDetailPrompts skill={skill} />
        </TabsContent>

        <TabsContent value="dependencies">
          <SkillDetailDependencies skill={skill} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
