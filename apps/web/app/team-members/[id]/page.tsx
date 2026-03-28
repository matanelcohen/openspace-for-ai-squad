'use client';

import type { Agent, Task } from '@openspace/shared';
import { TASK_STATUS_LABELS, TEAM_MEMBER_RANK_LABELS } from '@openspace/shared';
import {
  ArrowLeft,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Eye,
  FileText,
  ListTodo,
  Loader2,
  Mail,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { AgentAvatar } from '@/components/agent-avatar';
import { PriorityBadge } from '@/components/priority-badge';
import { AgentSkillDialog } from '@/components/skills/agent-skill-dialog';
import { RankManagementDialog } from '@/components/team-members/rank-management-dialog';
import { SkillsEditor } from '@/components/team-members/skills-editor';
import {
  StatusManagementSelect,
  TeamMemberStatusBadge,
} from '@/components/team-members/status-management';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAgentCharter, useUpdateAgentCharter } from '@/hooks/use-agent-charter';
import { useAgents } from '@/hooks/use-agents';
import { useAgentSkillsManagement } from '@/hooks/use-skills';
import { useTasks } from '@/hooks/use-tasks';
import {
  useTeamMember,
  useUpdateTeamMember,
  useUpdateTeamMemberRank,
  useUpdateTeamMemberStatus,
} from '@/hooks/use-team-members';
import { cn } from '@/lib/utils';

const rankStyles: Record<string, string> = {
  junior: 'bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/20',
  mid: 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20',
  senior: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/20',
  lead: 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/20',
  principal: 'bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/20',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── Agent Skills Card (manage AI agent skills inline) ────────────

function AgentSkillsCard({ agentId }: { agentId: string }) {
  const { data } = useAgentSkillsManagement(agentId);
  const enabledCount = data?.skills.filter((s) => s.enabled).length ?? 0;
  const totalCount = data?.skills.length ?? 0;

  return (
    <div className="text-sm">
      <span className="font-medium">{enabledCount}</span>
      <span className="text-muted-foreground">/{totalCount} skills</span>
    </div>
  );
}

function AgentSkillsSection() {
  const { data: agents } = useAgents();
  const [selectedAgent, setSelectedAgent] = useState<{
    id: string;
    name: string;
    role: string;
  } | null>(null);

  if (!agents?.length) return null;

  return (
    <Card data-testid="agent-skills-section">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Bot className="h-4 w-4" />
          AI Agent Skills
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => setSelectedAgent({ id: agent.id, name: agent.name, role: agent.role })}
              className="flex w-full items-center gap-3 rounded-md border p-2.5 transition-colors hover:bg-muted/50"
              data-testid={`agent-skills-row-${agent.id}`}
            >
              <AgentAvatar agentId={agent.id} name={agent.name} size="sm" />
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium truncate">{agent.name}</p>
                <p className="text-xs text-muted-foreground">{agent.role}</p>
              </div>
              <AgentSkillsCard agentId={agent.id} />
            </button>
          ))}
        </div>

        {selectedAgent && (
          <AgentSkillDialog
            agentId={selectedAgent.id}
            agentName={selectedAgent.name}
            agentRole={selectedAgent.role}
            open={!!selectedAgent}
            onOpenChange={(open) => !open && setSelectedAgent(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Agent Charter Section ────────────────────────────────────────

function agentSlugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function findMatchingAgent(agents: Agent[] | undefined, memberName: string): Agent | undefined {
  if (!agents) return undefined;
  const slug = agentSlugFromName(memberName);
  return agents.find((a) => a.id === slug);
}

function AgentCharterSection({
  agentId,
  agentName,
  agentRole,
  agentPersonality,
}: {
  agentId: string;
  agentName: string;
  agentRole: string;
  agentPersonality?: string;
}) {
  const { data: charterData, isLoading } = useAgentCharter(agentId);
  const updateCharter = useUpdateAgentCharter();
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [draft, setDraft] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const charter = charterData?.charter ?? null;

  useEffect(() => {
    if (charter !== null) {
      setDraft(charter);
    }
  }, [charter]);

  const handleEdit = useCallback(() => {
    setDraft(charter ?? '');
    setIsEditing(true);
    setShowPreview(false);
    setSaveSuccess(false);
  }, [charter]);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setShowPreview(false);
    setDraft(charter ?? '');
  }, [charter]);

  const handleSave = useCallback(() => {
    updateCharter.mutate(
      { agentId, charter: draft },
      {
        onSuccess: () => {
          setIsEditing(false);
          setShowPreview(false);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        },
      },
    );
  }, [agentId, draft, updateCharter]);

  const handleCreate = useCallback(() => {
    const template = `# ${agentName} — ${agentRole}\n\n> Describe this agent's personality and focus.\n\n## Identity\n\n- **Name:** ${agentName}\n- **Role:** ${agentRole}\n- **Expertise:** \n- **Style:** \n\n## What I Own\n\n- \n\n## How I Work\n\n- \n\n## Boundaries\n\n**I handle:** \n\n**I don't handle:** \n\n**When I'm unsure:** I say so and suggest who might know.\n\n## Voice\n\n`;
    setDraft(template);
    setIsEditing(true);
    setShowPreview(false);
  }, [agentName, agentRole]);

  // Build system prompt preview
  const personality = agentPersonality ?? 'Professional, collaborative, dedicated';
  const systemPromptPreview =
    `You are ${agentName}, the ${agentRole} of the openspace.ai squad. ` +
    `Personality: ${personality}\n\n` +
    `You have been assigned a task. Execute it fully — write code, create files, make changes. ` +
    `Do the actual work, don't just describe what you would do.\n\n` +
    `[Skills prompt injected based on role-matched skills]\n\n` +
    `When done, provide a brief summary of what you did.`;

  if (isLoading) {
    return (
      <Card data-testid="agent-charter-section">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Agent Prompt
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="agent-charter-section">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Agent Prompt
            {saveSuccess && (
              <Badge variant="outline" className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20 text-[10px]">
                <Check className="h-3 w-3 mr-1" />
                Saved
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {!isEditing && charter !== null && (
              <Button variant="ghost" size="sm" onClick={handleEdit} data-testid="charter-edit-btn">
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {charter === null && !isEditing ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              <div>
                <p className="text-sm font-medium text-muted-foreground">No charter yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Create a charter to define this agent&apos;s identity, expertise, and boundaries.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCreate} data-testid="charter-create-btn">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Create Charter
              </Button>
            </div>
          ) : isEditing ? (
            <div className="space-y-3">
              {/* Edit/Preview toggle */}
              <div className="flex items-center gap-1.5">
                <Button
                  variant={!showPreview ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowPreview(false)}
                  className="text-xs h-7"
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <Button
                  variant={showPreview ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setShowPreview(true)}
                  className="text-xs h-7"
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Preview
                </Button>
              </div>

              {showPreview ? (
                <div className="prose prose-sm dark:prose-invert max-w-none rounded-md border p-4 min-h-[320px]" data-testid="charter-preview">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{draft}</ReactMarkdown>
                </div>
              ) : (
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="font-mono text-sm min-h-[320px] resize-y"
                  rows={20}
                  placeholder="# Agent Name — Role&#10;&#10;> Personality description..."
                  data-testid="charter-editor"
                />
              )}

              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancel}
                  disabled={updateCharter.isPending}
                  data-testid="charter-cancel-btn"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={updateCharter.isPending}
                  data-testid="charter-save-btn"
                >
                  {updateCharter.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Save Charter
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none" data-testid="charter-viewer">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{charter ?? ''}</ReactMarkdown>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Prompt Preview */}
      <Card data-testid="system-prompt-preview">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Bot className="h-4 w-4" />
            System Prompt Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            This is the system prompt used when this agent responds in chat or works on tasks.
          </p>
          <pre className="rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap break-words leading-relaxed overflow-x-auto">
            {systemPromptPreview}
          </pre>
        </CardContent>
      </Card>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-4">
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
        <div className="md:col-span-2 space-y-4">
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}

export default function TeamMemberDetailPage() {
  const params = useParams<{ id: string }>();
  const { data: member, isLoading, error } = useTeamMember(params.id);
  const updateRank = useUpdateTeamMemberRank();
  const updateStatus = useUpdateTeamMemberStatus();
  const updateMember = useUpdateTeamMember();
  const { data: allTasks } = useTasks();
  const { data: agents } = useAgents();

  const matchingAgent = useMemo(
    () => (member ? findMatchingAgent(agents, member.name) : undefined),
    [agents, member],
  );

  const assignedTasks = useMemo(() => {
    if (!allTasks || !member) return [];
    const memberNameLower = member.name.toLowerCase();
    return allTasks.filter((t) => t.assignee && t.assignee.toLowerCase() === memberNameLower);
  }, [allTasks, member]);

  if (isLoading) return <DetailSkeleton />;

  if (error || !member) {
    return (
      <div className="space-y-4">
        <Link href="/team-members">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Back to Team
          </Button>
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            {error ? `Failed to load member: ${error.message}` : 'Member not found.'}
          </p>
        </div>
      </div>
    );
  }

  const handleSkillsChange = (skills: string[]) => {
    updateMember.mutate({
      memberId: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      department: member.department,
      skills,
      rank: member.rank,
      status: member.status,
    });
  };

  return (
    <div className="space-y-6" data-testid="team-member-detail">
      {/* Back link */}
      <Link href="/team-members">
        <Button variant="ghost" size="sm" className="gap-1.5">
          <ArrowLeft className="h-4 w-4" />
          Back to Team
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-semibold">
            {getInitials(member.name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{member.name}</h1>
          <p className="text-muted-foreground">{member.role}</p>
          <div className="flex items-center gap-2 pt-1">
            <TeamMemberStatusBadge status={member.status} />
            <Badge variant="outline" className={cn(rankStyles[member.rank])}>
              {TEAM_MEMBER_RANK_LABELS[member.rank]}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Sidebar info */}
        <div className="space-y-4">
          {/* Contact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{member.email}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span>{member.department}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>

          {/* Status management */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Employment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusManagementSelect
                currentStatus={member.status}
                onStatusChange={(status) => updateStatus.mutate({ memberId: member.id, status })}
                disabled={updateStatus.isPending}
              />
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="md:col-span-2 space-y-4">
          {/* Rank management */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Seniority Rank</CardTitle>
              <RankManagementDialog
                currentRank={member.rank}
                memberName={member.name}
                onRankChange={(rank) => updateRank.mutate({ memberId: member.id, rank })}
                isPending={updateRank.isPending}
              />
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <Badge
                  variant="outline"
                  className={cn('text-sm px-3 py-1', rankStyles[member.rank])}
                >
                  {TEAM_MEMBER_RANK_LABELS[member.rank]}
                </Badge>
                {/* Rank level dots */}
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const rankIndex = ['junior', 'mid', 'senior', 'lead', 'principal'].indexOf(
                      member.rank,
                    );
                    return (
                      <div
                        key={i}
                        className={cn(
                          'h-2.5 w-2.5 rounded-full',
                          i <= rankIndex ? 'bg-primary' : 'bg-muted',
                        )}
                      />
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Skills */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Skills & Expertise</CardTitle>
            </CardHeader>
            <CardContent>
              <SkillsEditor skills={member.skills} onSkillsChange={handleSkillsChange} editable />
            </CardContent>
          </Card>

          {/* Assigned Tasks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Assigned Tasks</CardTitle>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ListTodo className="h-3.5 w-3.5" />
                <span>
                  {assignedTasks.length} task{assignedTasks.length !== 1 ? 's' : ''}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              {assignedTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks assigned to this member.</p>
              ) : (
                <div className="space-y-2" data-testid="assigned-tasks-list">
                  {assignedTasks.map((task: Task) => (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="flex items-center justify-between rounded-md border p-3 transition-colors hover:bg-muted/50"
                      data-testid={`assigned-task-${task.id}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2
                          className={cn(
                            'h-4 w-4 shrink-0',
                            task.status === 'done' ? 'text-green-500' : 'text-muted-foreground',
                          )}
                        />
                        <span className="truncate text-sm font-medium">{task.title}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <PriorityBadge priority={task.priority} />
                        <Badge variant="outline" className="text-[10px]">
                          {TASK_STATUS_LABELS[task.status]}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* AI Agent Skills Management */}
          <AgentSkillsSection />

          {/* Agent Charter / Prompt */}
          {matchingAgent && (
            <AgentCharterSection
              agentId={matchingAgent.id}
              agentName={matchingAgent.name}
              agentRole={matchingAgent.role}
            />
          )}
        </div>
      </div>
    </div>
  );
}
