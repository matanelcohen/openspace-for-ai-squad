'use client';

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Database,
  Info,
  Server,
  Settings,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { useHealthCheck, usePruneMessages, useSystemConfig } from '@/hooks/use-settings';
import { useSquad } from '@/hooks/use-squad';
import { useActiveWorkspace, useDeleteSquad } from '@/hooks/use-workspaces';
import { api } from '@/lib/api-client';

function HealthCheckSection() {
  const { data: health, isLoading, refetch, isFetching } = useHealthCheck();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Activity className="h-5 w-5" />
          System Health
        </CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          disabled={isFetching}
        >
          {isFetching ? 'Checking…' : 'Run Doctor'}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner message="Running health checks…" />
        ) : !health ? (
          <p className="text-sm text-muted-foreground">
            Click &quot;Run Doctor&quot; to check system health.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  health.status === 'healthy'
                    ? 'default'
                    : health.status === 'degraded'
                      ? 'secondary'
                      : 'destructive'
                }
              >
                {health.status}
              </Badge>
              {health.uptime != null && (
                <span className="text-sm text-muted-foreground">
                  Uptime: {Math.floor(health.uptime / 3600)}h {Math.floor((health.uptime % 3600) / 60)}m
                </span>
              )}
            </div>
            <div className="space-y-2">
              {(health.checks ?? []).map((check) => (
                <div
                  key={check.name}
                  className="flex items-center gap-2 rounded-md border px-3 py-2"
                >
                  {check.status === 'ok' ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-500" />
                  ) : check.status === 'warn' ? (
                    <Activity className="h-4 w-4 shrink-0 text-yellow-500" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0 text-red-500" />
                  )}
                  <span className="text-sm font-medium">{check.name}</span>
                  {check.message && (
                    <span className="text-sm text-muted-foreground">— {check.message}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ModelConfigSection() {
  const { data: config, isLoading } = useSystemConfig();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Server className="h-5 w-5" />
          Model Configuration
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner message="Loading configuration…" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border px-3 py-2">
              <p className="text-xs text-muted-foreground">Copilot SDK</p>
              <div className="flex items-center gap-2">
                {config?.copilotConnected ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span className="font-medium text-green-700 dark:text-green-400">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500" />
                    <span className="font-medium text-red-700 dark:text-red-400">
                      {config?.providerType === 'mock' ? 'Mock Mode' : 'Disconnected'}
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="rounded-md border px-3 py-2">
              <p className="text-xs text-muted-foreground">Primary Model</p>
              <p className="font-medium">{config?.model ?? 'Default'}</p>
            </div>
            <div className="rounded-md border px-3 py-2">
              <p className="text-xs text-muted-foreground">Fallback Model</p>
              <p className="font-medium">{config?.fallbackModel ?? 'None'}</p>
            </div>
            <div className="rounded-md border px-3 py-2">
              <p className="text-xs text-muted-foreground">Failover Status</p>
              <div className="flex items-center gap-2">
                <Badge variant={config?.failoverActive ? 'destructive' : 'default'}>
                  {config?.failoverActive ? 'Active' : 'Normal'}
                </Badge>
              </div>
            </div>
            {config?.cliUrl && (
              <div className="rounded-md border px-3 py-2 sm:col-span-2">
                <p className="text-xs text-muted-foreground">CLI Server</p>
                <p className="truncate font-mono text-sm">{config.cliUrl}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ChatPruningSection() {
  const [maxAgeDays, setMaxAgeDays] = useState(30);
  const [maxPerChannel, setMaxPerChannel] = useState(500);
  const pruneMutation = usePruneMessages();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Database className="h-5 w-5" />
          Chat Pruning
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Remove old chat messages to free up storage and improve performance.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="maxAgeDays" className="mb-1 block text-sm font-medium">
              Max Age (days)
            </label>
            <input
              id="maxAgeDays"
              type="number"
              min={1}
              value={maxAgeDays}
              onChange={(e) => setMaxAgeDays(Number(e.target.value))}
              className="h-9 w-24 rounded-md border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label htmlFor="maxPerChannel" className="mb-1 block text-sm font-medium">
              Max per Channel
            </label>
            <input
              id="maxPerChannel"
              type="number"
              min={1}
              value={maxPerChannel}
              onChange={(e) => setMaxPerChannel(Number(e.target.value))}
              className="h-9 w-24 rounded-md border bg-background px-3 text-sm"
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => pruneMutation.mutate({ maxAgeDays, maxPerChannel })}
            disabled={pruneMutation.isPending}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {pruneMutation.isPending ? 'Pruning…' : 'Prune Messages'}
          </Button>
        </div>
        {pruneMutation.isSuccess && pruneMutation.data && (
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            ✓ {(pruneMutation.data as { deletedCount?: number; message?: string }).message ??
              `Deleted ${(pruneMutation.data as { deletedCount?: number }).deletedCount ?? 0} messages`}
          </div>
        )}
        {pruneMutation.isError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            ✗ Failed to prune: {pruneMutation.error?.message}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AboutSection() {
  const { data: config, isLoading: configLoading } = useSystemConfig();
  const { data: squad, isLoading: squadLoading } = useSquad();
  const isLoading = configLoading || squadLoading;

  const agentCount = squad?.agents?.length ?? config?.agentCount ?? 0;
  const taskCount =
    Object.values(squad?.taskCounts?.byStatus ?? {}).reduce((sum, v) => sum + (v as number), 0) ??
    config?.taskCount ??
    0;
  const skillCount = config?.skillCount ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Info className="h-5 w-5" />
          About
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner message="Loading…" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border px-3 py-2 text-center">
              <p className="text-2xl font-bold">{agentCount}</p>
              <p className="text-xs text-muted-foreground">Agents</p>
            </div>
            <div className="rounded-md border px-3 py-2 text-center">
              <p className="text-2xl font-bold">{taskCount}</p>
              <p className="text-xs text-muted-foreground">Tasks</p>
            </div>
            <div className="rounded-md border px-3 py-2 text-center">
              <p className="text-2xl font-bold">{skillCount}</p>
              <p className="text-xs text-muted-foreground">Skills</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DangerZoneSection() {
  const { data: workspace } = useActiveWorkspace();
  const deleteSquad = useDeleteSquad();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cleaningWorktrees, setCleaningWorktrees] = useState(false);
  const [worktreeResult, setWorktreeResult] = useState<string | null>(null);

  const handleDelete = () => {
    if (!workspace?.id) return;
    deleteSquad.mutate(workspace.id, {
      onSuccess: () => {
        setConfirmOpen(false);
        window.location.reload();
      },
    });
  };

  const handleCleanWorktrees = async () => {
    setCleaningWorktrees(true);
    setWorktreeResult(null);
    try {
      const result = await api.delete<{ destroyed: number; total: number }>('/api/worktrees');
      setWorktreeResult(`✅ Cleaned ${result.destroyed}/${result.total} worktrees`);
    } catch (err) {
      setWorktreeResult(`❌ Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setCleaningWorktrees(false);
  };

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg text-destructive">
          <AlertTriangle className="h-5 w-5" />
          Danger Zone
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-md border border-destructive/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Clear All Sandboxes</p>
            <p className="text-xs text-muted-foreground">
              Remove all git worktrees and their branches. Frees disk space and resets sandbox state.
            </p>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCleanWorktrees}
            disabled={cleaningWorktrees}
          >
            <Trash2 className="mr-1 h-4 w-4" />
            {cleaningWorktrees ? 'Cleaning…' : 'Clear Worktrees'}
          </Button>
        </div>
        {worktreeResult && (
          <p className="text-sm text-muted-foreground">{worktreeResult}</p>
        )}

        <div className="flex items-center justify-between rounded-md border border-destructive/30 px-4 py-3">
          <div>
            <p className="text-sm font-medium">Delete Squad</p>
            <p className="text-xs text-muted-foreground">
              Remove the .squad directory and all agent configs from the active workspace.
            </p>
          </div>
          {!confirmOpen ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Delete Squad
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleteSquad.isPending}
              >
                {deleteSquad.isPending ? 'Deleting…' : 'Yes, delete it'}
              </Button>
            </div>
          )}
        </div>
        {deleteSquad.isError && (
          <p className="text-sm text-destructive">
            Failed to delete: {deleteSquad.error?.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Settings className="h-8 w-8" />
          System Settings
        </h1>
        <p className="text-muted-foreground">
          Monitor system health, configure models, and manage data.
        </p>
      </div>

      <HealthCheckSection />
      <ModelConfigSection />
      <ChatPruningSection />
      <AboutSection />
      <DangerZoneSection />
    </div>
  );
}
