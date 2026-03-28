'use client';

import { LayoutGrid, List, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { DepartmentOverview } from '@/components/team-members/department-overview';
import { TeamMemberCard } from '@/components/team-members/team-member-card';
import {
  type TeamMemberFilters,
  TeamMemberFiltersToolbar,
} from '@/components/team-members/team-member-filters-toolbar';
import { TeamMemberFormDialog } from '@/components/team-members/team-member-form-dialog';
import { TeamMemberListView } from '@/components/team-members/team-member-list-view';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SquadGuard } from '@/components/workspace/squad-guard';
import { useTeamMembers } from '@/hooks/use-team-members';

type ViewMode = 'grid' | 'table';

function MemberCardSkeleton() {
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-3 w-40" />
      <div className="flex gap-2">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
    </div>
  );
}

export default function TeamMembersPage() {
  const { data: members, isLoading, error } = useTeamMembers();
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filters, setFilters] = useState<TeamMemberFilters>({
    department: 'all',
    status: 'all',
    rank: 'all',
    search: '',
  });

  const filtered = members?.filter((m) => {
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

  return (
    <SquadGuard>
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Team Members</h1>
          <p className="text-muted-foreground">
            Manage your team&apos;s members, ranks, and departments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-md border" data-testid="view-toggle">
            <Button
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              data-testid="view-toggle-grid"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
              aria-label="Table view"
              data-testid="view-toggle-table"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button
            className="gap-2"
            onClick={() => setDialogOpen(true)}
            data-testid="add-member-button"
          >
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        </div>
      </div>

      {/* Department & rank overview */}
      {!isLoading && members && members.length > 0 && <DepartmentOverview members={members} />}

      {viewMode === 'table' ? (
        <TeamMemberListView />
      ) : (
        <>
          {/* Filters */}
          <TeamMemberFiltersToolbar filters={filters} onFiltersChange={setFilters} />

          {/* Error state */}
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">
                Failed to load team members: {error.message}
              </p>
            </div>
          )}

          {/* Loading state */}
          {isLoading && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <MemberCardSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Member grid */}
          {!isLoading && filtered && (
            <>
              <p className="text-sm text-muted-foreground">
                {filtered.length} member{filtered.length !== 1 ? 's' : ''}
                {filters.department !== 'all' ||
                filters.status !== 'all' ||
                filters.rank !== 'all' ||
                filters.search
                  ? ' matching filters'
                  : ''}
              </p>
              {filtered.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filtered.map((member) => (
                    <TeamMemberCard key={member.id} member={member} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
                  <p className="text-sm text-muted-foreground">No team members found.</p>
                </div>
              )}
            </>
          )}
        </>
      )}

      <TeamMemberFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
    </SquadGuard>
  );
}
