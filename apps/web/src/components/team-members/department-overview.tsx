'use client';

import type { TeamMember } from '@matanelcohen/openspace-shared';
import { DEPARTMENTS, TEAM_MEMBER_RANK_LABELS, TEAM_MEMBER_RANKS } from '@matanelcohen/openspace-shared';
import { Building2, Users } from 'lucide-react';

import { AnimatedNumber } from '@/components/dashboard/animated-number';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const rankColors: Record<string, string> = {
  junior: 'bg-slate-500',
  mid: 'bg-blue-500',
  senior: 'bg-violet-500',
  lead: 'bg-purple-500',
  principal: 'bg-pink-500',
};

interface DepartmentOverviewProps {
  members: TeamMember[];
}

export function DepartmentOverview({ members }: DepartmentOverviewProps) {
  const byDepartment = DEPARTMENTS.reduce<Record<string, number>>((acc, dept) => {
    acc[dept] = members.filter((m) => m.department === dept).length;
    return acc;
  }, {});

  const byRank = TEAM_MEMBER_RANKS.reduce<Record<string, number>>((acc, rank) => {
    acc[rank] = members.filter((m) => m.rank === rank).length;
    return acc;
  }, {});

  const activeDepartments = Object.entries(byDepartment)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a);

  const totalMembers = members.length;

  return (
    <div className="grid gap-4 md:grid-cols-2" data-testid="department-overview">
      {/* Department distribution */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Department Distribution</CardTitle>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {activeDepartments.length > 0 ? (
            activeDepartments.map(([dept, count]) => {
              const percentage = totalMembers > 0 ? Math.round((count / totalMembers) * 100) : 0;
              return (
                <div key={dept} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{dept}</span>
                    <span className="text-muted-foreground">
                      {count} ({percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div
                      className="h-2 rounded-full bg-primary transition-all"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">No team members yet</p>
          )}
        </CardContent>
      </Card>

      {/* Rank distribution */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Rank Distribution</CardTitle>
          <Users className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {TEAM_MEMBER_RANKS.map((rank) => {
            const count = byRank[rank] ?? 0;
            return (
              <div key={rank} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${rankColors[rank]}`} />
                  <span className="text-sm">{TEAM_MEMBER_RANK_LABELS[rank]}</span>
                </div>
                <Badge variant="secondary" className="text-xs tabular-nums">
                  <AnimatedNumber value={count} />
                </Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
