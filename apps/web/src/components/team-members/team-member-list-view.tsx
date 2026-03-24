'use client';

import type { TeamMember, TeamMemberRank } from '@openspace/shared';
import { TEAM_MEMBER_RANK_LABELS, TEAM_MEMBER_STATUS_LABELS } from '@openspace/shared';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

import {
  type TeamMemberFilters,
  TeamMemberFiltersToolbar,
} from '@/components/team-members/team-member-filters-toolbar';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTeamMembers } from '@/hooks/use-team-members';
import { cn } from '@/lib/utils';

type SortField = 'name' | 'role' | 'department' | 'status' | 'rank' | 'joinedAt';
type SortDir = 'asc' | 'desc';

const rankOrder: Record<TeamMemberRank, number> = {
  junior: 0,
  mid: 1,
  senior: 2,
  lead: 3,
  principal: 4,
};

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

function applyFilters(members: TeamMember[], filters: TeamMemberFilters): TeamMember[] {
  return members.filter((m) => {
    if (filters.department !== 'all' && m.department !== filters.department) return false;
    if (filters.status !== 'all' && m.status !== filters.status) return false;
    if (filters.rank !== 'all' && m.rank !== filters.rank) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.role.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        m.skills.some((s) => s.toLowerCase().includes(q))
      );
    }
    return true;
  });
}

function sortMembers(members: TeamMember[], field: SortField, dir: SortDir): TeamMember[] {
  const sorted = [...members].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case 'name':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'role':
        cmp = a.role.localeCompare(b.role);
        break;
      case 'department':
        cmp = a.department.localeCompare(b.department);
        break;
      case 'status':
        cmp = a.status.localeCompare(b.status);
        break;
      case 'rank':
        cmp = rankOrder[a.rank] - rankOrder[b.rank];
        break;
      case 'joinedAt':
        cmp = new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime();
        break;
    }
    return cmp;
  });
  return dir === 'desc' ? sorted.reverse() : sorted;
}

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
}) {
  if (field !== sortField)
    return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground" />;
  return sortDir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

export function TeamMemberListView() {
  const { data: members, isLoading, error } = useTeamMembers();
  const [filters, setFilters] = useState<TeamMemberFilters>({
    department: 'all',
    status: 'all',
    rank: 'all',
    search: '',
  });
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const filteredAndSorted = useMemo(() => {
    if (!members) return [];
    const filtered = applyFilters(members, filters);
    return sortMembers(filtered, sortField, sortDir);
  }, [members, filters, sortField, sortDir]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="member-list-loading">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
        data-testid="member-list-error"
      >
        <p className="text-sm text-destructive">Failed to load team members: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="team-member-list-view">
      <TeamMemberFiltersToolbar filters={filters} onFiltersChange={setFilters} />

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                Name <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-40"
                onClick={() => handleSort('role')}
              >
                Role <SortIcon field="role" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-36"
                onClick={() => handleSort('department')}
              >
                Department <SortIcon field="department" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-32"
                onClick={() => handleSort('status')}
              >
                Status <SortIcon field="status" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead
                className="cursor-pointer select-none w-32"
                onClick={() => handleSort('rank')}
              >
                Rank <SortIcon field="rank" sortField={sortField} sortDir={sortDir} />
              </TableHead>
              <TableHead className="w-40">Skills</TableHead>
              <TableHead
                className="cursor-pointer select-none w-32"
                onClick={() => handleSort('joinedAt')}
              >
                Joined <SortIcon field="joinedAt" sortField={sortField} sortDir={sortDir} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No team members match your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((member) => (
                <TableRow key={member.id} data-testid={`member-row-${member.id}`}>
                  <TableCell>
                    <Link
                      href={`/team-members/${member.id}`}
                      className="flex items-center gap-2 hover:underline"
                      data-testid={`member-link-${member.id}`}
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{member.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">{member.role}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {member.department}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-xs', statusStyles[member.status])}>
                      {TEAM_MEMBER_STATUS_LABELS[member.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-xs', rankStyles[member.rank])}>
                      {TEAM_MEMBER_RANK_LABELS[member.rank]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {member.skills.slice(0, 2).map((skill) => (
                        <Badge key={skill} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {skill}
                        </Badge>
                      ))}
                      {member.skills.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">
                          +{member.skills.length - 2}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground" data-testid="member-list-count">
        {filteredAndSorted.length} of {members?.length ?? 0} members
      </p>
    </div>
  );
}
