'use client';

import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';

import { AgentAvatar } from '@/components/agent-avatar';
import { SkillDetailInstructions } from '@/components/skills/skill-detail-instructions';
import { SkillDetailOverview } from '@/components/skills/skill-detail-overview';
import { SkillFormDialog } from '@/components/skills/skill-form-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAgents } from '@/hooks/use-agents';
import { useAgentSkillsManagement, useDeleteSkill, useSkillDetail } from '@/hooks/use-skills';

export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { data: skill, isLoading, error } = useSkillDetail(params.id);
  const deleteSkill = useDeleteSkill();
  const [editOpen, setEditOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteSkill.mutateAsync(params.id);
      router.push('/skills');
    } catch {
      // Error is handled by react-query
    }
  };

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
      <div className="flex items-center justify-between">
        <Link href="/skills">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to Skill Store
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            data-testid="edit-skill-btn"
          >
            <Pencil className="mr-1 h-4 w-4" />
            Edit
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                data-testid="delete-skill-btn"
              >
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent data-testid="delete-skill-confirm">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Skill</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete &quot;{skill.manifest.name}&quot;? This action
                  cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  data-testid="delete-skill-confirm-btn"
                >
                  {deleteSkill.isPending ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <SkillFormDialog
        skill={skill}
        open={editOpen}
        onOpenChange={setEditOpen}
        onCreated={() => setEditOpen(false)}
      />

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
      </Tabs>
    </div>
  );
}

function SkillAgentsList({ skillId }: { skillId: string }) {
  const { data: agents = [] } = useAgents();
  const filteredAgents = agents.filter((a) => !['scribe', 'ralph'].includes(a.id));

  return (
    <div className="space-y-3 py-2" data-testid="skill-detail-agents">
      {filteredAgents.map((agent) => (
        <SkillAgentRow key={agent.id} agent={agent} skillId={skillId} />
      ))}
    </div>
  );
}

function SkillAgentRow({ agent, skillId }: { agent: { id: string; name: string; role: string }; skillId: string }) {
  const { data } = useAgentSkillsManagement(agent.id);
  const skills = data?.skills ?? [];
  const match = skills.find((s: { id: string }) => s.id === skillId);
  const enabled = match?.enabled ?? false;
  const source = match?.source;

  if (!enabled) return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <AgentAvatar agentId={agent.id} name={agent.name} size="sm" />
      <div className="flex-1">
        <div className="text-sm font-medium">{agent.name}</div>
        <div className="text-xs text-muted-foreground">{agent.role}</div>
      </div>
      <Badge variant="outline" className="text-xs">
        {source === 'role-match' ? 'Auto' : 'Custom'}
      </Badge>
    </div>
  );
}
