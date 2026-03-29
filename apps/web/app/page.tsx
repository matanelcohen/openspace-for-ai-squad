'use client';

import { Rocket } from 'lucide-react';
import { useState } from 'react';

import { DashboardActivitySidebar } from '@/components/dashboard/activity-sidebar';
import { AgentGrid } from '@/components/dashboard/agent-grid';
import { SummaryStats } from '@/components/dashboard/summary-stats';
import { SystemStatus } from '@/components/dashboard/system-status';
import { TeamSummaryStats } from '@/components/dashboard/team-summary-stats';
import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { SquadInitWizard } from '@/components/workspace/squad-init-wizard';
import { useActiveWorkspace, useWorkspaceStatus } from '@/hooks/use-workspaces';

export default function DashboardPage() {
  const { data: workspace, isLoading: wsLoading } = useActiveWorkspace();
  const { data: status, isLoading: statusLoading } = useWorkspaceStatus(workspace?.id);
  const [wizardOpen, setWizardOpen] = useState(false);

  if (wsLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" message="Loading workspace…" />
      </div>
    );
  }

  if (workspace && status && !status.initialized) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="mx-auto max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Rocket className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Welcome to openspace.ai
            </h1>
            <p className="text-muted-foreground">
              This project doesn&apos;t have a squad yet. Initialize one to get started!
            </p>
          </div>
          <Button size="lg" onClick={() => setWizardOpen(true)}>
            <Rocket className="mr-2 h-4 w-4" />
            Initialize Squad
          </Button>
          <SquadInitWizard
            open={wizardOpen}
            onOpenChange={setWizardOpen}
            workspaceId={workspace.id}
            workspaceName={workspace.name}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Your squad at a glance.</p>
        </div>
        <SummaryStats />
        <SystemStatus />
        <div>
          <h2 className="mb-4 text-xl font-semibold">Team Overview</h2>
          <TeamSummaryStats />
        </div>
        <div>
          <h2 className="mb-4 text-xl font-semibold">Squad Members</h2>
          <AgentGrid />
        </div>
      </div>
      <aside className="hidden w-72 shrink-0 xl:block">
        <div className="sticky top-4 h-[calc(100vh-6rem)]">
          <DashboardActivitySidebar />
        </div>
      </aside>
    </div>
  );
}
