'use client';

import type { TeamMember } from '@matanelcohen/openspace-shared';
import { TEAM_MEMBER_RANK_LABELS, TEAM_MEMBER_STATUS_LABELS } from '@matanelcohen/openspace-shared';
import { Mail } from 'lucide-react';
import Link from 'next/link';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TeamMemberCardProps {
  member: TeamMember;
}

const statusStyles: Record<TeamMember['status'], string> = {
  active: 'bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/20',
  inactive: 'bg-gray-500/15 text-gray-700 dark:text-gray-400 border-gray-500/20',
  'on-leave': 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20',
};

const rankStyles: Record<TeamMember['rank'], string> = {
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

export function TeamMemberCard({ member }: TeamMemberCardProps) {
  return (
    <Link href={`/team-members/${member.id}`}>
      <Card
        className="transition-shadow hover:shadow-md cursor-pointer"
        data-testid={`member-card-${member.id}`}
      >
        <CardHeader className="flex flex-row items-center gap-3 p-4 pb-2">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {getInitials(member.name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{member.name}</p>
            <p className="truncate text-xs text-muted-foreground">{member.role}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="h-3 w-3" />
            <span className="truncate">{member.email}</span>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn('text-[10px] px-1.5 py-0', statusStyles[member.status])}
            >
              {TEAM_MEMBER_STATUS_LABELS[member.status]}
            </Badge>
            <Badge
              variant="outline"
              className={cn('text-[10px] px-1.5 py-0', rankStyles[member.rank])}
            >
              {TEAM_MEMBER_RANK_LABELS[member.rank]}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {member.department}
            </Badge>
          </div>

          {member.skills.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {member.skills.slice(0, 3).map((skill) => (
                <Badge key={skill} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {skill}
                </Badge>
              ))}
              {member.skills.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{member.skills.length - 3}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
