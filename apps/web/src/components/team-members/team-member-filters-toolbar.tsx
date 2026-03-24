'use client';

import type { TeamMemberRank, TeamMemberStatus } from '@openspace/shared';
import {
  DEPARTMENTS,
  TEAM_MEMBER_RANK_LABELS,
  TEAM_MEMBER_RANKS,
  TEAM_MEMBER_STATUS_LABELS,
  TEAM_MEMBER_STATUSES,
} from '@openspace/shared';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface TeamMemberFilters {
  department: string | 'all';
  status: TeamMemberStatus | 'all';
  rank: TeamMemberRank | 'all';
  search: string;
}

interface TeamMemberFiltersToolbarProps {
  filters: TeamMemberFilters;
  onFiltersChange: (filters: TeamMemberFilters) => void;
}

export function TeamMemberFiltersToolbar({
  filters,
  onFiltersChange,
}: TeamMemberFiltersToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3" data-testid="team-member-filters-toolbar">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="w-56 pl-9"
          data-testid="filter-search"
        />
      </div>

      <Select
        value={filters.department}
        onValueChange={(val) => onFiltersChange({ ...filters, department: val })}
      >
        <SelectTrigger className="w-40" data-testid="filter-department">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          {DEPARTMENTS.map((d) => (
            <SelectItem key={d} value={d}>
              {d}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.status}
        onValueChange={(val) =>
          onFiltersChange({ ...filters, status: val as TeamMemberStatus | 'all' })
        }
      >
        <SelectTrigger className="w-36" data-testid="filter-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {TEAM_MEMBER_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {TEAM_MEMBER_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.rank}
        onValueChange={(val) =>
          onFiltersChange({ ...filters, rank: val as TeamMemberRank | 'all' })
        }
      >
        <SelectTrigger className="w-36" data-testid="filter-rank">
          <SelectValue placeholder="Rank" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Ranks</SelectItem>
          {TEAM_MEMBER_RANKS.map((r) => (
            <SelectItem key={r} value={r}>
              {TEAM_MEMBER_RANK_LABELS[r]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
