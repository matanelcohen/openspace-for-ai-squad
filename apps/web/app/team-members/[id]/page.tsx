'use client';

import { TEAM_MEMBER_RANK_LABELS } from '@openspace/shared';
import { ArrowLeft, Building2, Calendar, Mail } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

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
        </div>
      </div>
    </div>
  );
}
