'use client';

import { Rocket, Square, Zap } from 'lucide-react';
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
import { useScanYolo,useStartYolo, useStopYolo, useYoloStatus } from '@/hooks/use-yolo';

export default function DashboardPage() {
  const { data: workspace, isLoading: wsLoading } = useActiveWorkspace();
  const { data: status, isLoading: statusLoading } = useWorkspaceStatus(workspace?.id);
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: yolo } = useYoloStatus();
  const startYolo = useStartYolo();
  const stopYolo = useStopYolo();
  const scanYolo = useScanYolo();

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
        {/* YOLO Mode */}
        {yolo && !yolo.enabled && (
          <button
            type="button"
            onClick={() => startYolo.mutate({})}
            disabled={startYolo.isPending}
            className="w-full rounded-lg border-2 border-dashed border-purple-300 bg-purple-50/50 p-4 text-center transition-colors hover:border-purple-400 hover:bg-purple-100/50 dark:border-purple-700 dark:bg-purple-950/30 dark:hover:border-purple-600 dark:hover:bg-purple-950/50"
          >
            <span className="text-lg font-semibold text-purple-700 dark:text-purple-300">
              🚀 YOLO Mode — Let the lead agent run the board
            </span>
          </button>
        )}
        {yolo?.enabled && (
          <div className="rounded-lg border border-green-300 bg-green-50/50 p-4 dark:border-green-700 dark:bg-green-950/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="inline-block h-3 w-3 rounded-full bg-green-500"
                  style={{ animation: 'pulse 2s ease-in-out infinite' }}
                />
                <span className="text-lg font-semibold text-green-700 dark:text-green-300">
                  🚀 YOLO Mode Active
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => scanYolo.mutate()}
                  disabled={scanYolo.isPending}
                  className="gap-1"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Scan Now
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => stopYolo.mutate()}
                  disabled={stopYolo.isPending}
                  className="gap-1 border-red-300 text-red-700 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </Button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
              <span>Assigned: {yolo.results.assigned}</span>
              <span className="text-muted-foreground/40">|</span>
              <span>Skipped: {yolo.results.skipped}</span>
              <span className="text-muted-foreground/40">|</span>
              <span>
                Last scan: {yolo.lastScanAt ? `${Math.round((Date.now() - new Date(yolo.lastScanAt).getTime()) / 1000)}s ago` : 'never'}
              </span>
              <span className="text-muted-foreground/40">|</span>
              <span>Next in: {Math.round(yolo.nextScanIn / 1000)}s</span>
            </div>
          </div>
        )}

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
