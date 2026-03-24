'use client';

import { Building2, Crown, TrendingUp, Users } from 'lucide-react';

import { AnimatedNumber } from '@/components/dashboard/animated-number';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTeamMembers } from '@/hooks/use-team-members';

function StatCardSkeleton() {
  return (
    <Card data-testid="team-stat-card-skeleton">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-7 w-12" />
        <Skeleton className="mt-1 h-3 w-32" />
      </CardContent>
    </Card>
  );
}

export function TeamSummaryStats() {
  const { data: members, isLoading, error } = useTeamMembers();

  if (isLoading) {
    return (
      <div
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        data-testid="team-summary-stats-loading"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-lg border border-destructive/50 bg-destructive/10 p-4"
        data-testid="team-summary-stats-error"
      >
        <p className="text-sm text-destructive">Failed to load team stats: {error.message}</p>
      </div>
    );
  }

  const allMembers = members ?? [];
  const totalMembers = allMembers.length;
  const activeMembers = allMembers.filter((m) => m.status === 'active').length;

  // Count unique departments
  const departments = new Set(allMembers.map((m) => m.department));
  const departmentCount = departments.size;

  // Senior+ count (senior, lead, principal)
  const seniorPlus = allMembers.filter((m) =>
    ['senior', 'lead', 'principal'].includes(m.rank),
  ).length;

  const statConfig = [
    {
      key: 'total',
      label: 'Total Members',
      icon: Users,
      value: totalMembers,
      description: 'Team members in the organization',
      color: 'text-blue-500',
    },
    {
      key: 'active',
      label: 'Active',
      icon: TrendingUp,
      value: activeMembers,
      description: 'Currently active members',
      color: 'text-green-500',
    },
    {
      key: 'departments',
      label: 'Departments',
      icon: Building2,
      value: departmentCount,
      description: 'Across the organization',
      color: 'text-purple-500',
    },
    {
      key: 'senior',
      label: 'Senior+',
      icon: Crown,
      value: seniorPlus,
      description: 'Senior, lead & principal',
      color: 'text-amber-500',
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4" data-testid="team-summary-stats">
      {statConfig.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.key}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <Icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                <AnimatedNumber value={stat.value} />
              </div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
