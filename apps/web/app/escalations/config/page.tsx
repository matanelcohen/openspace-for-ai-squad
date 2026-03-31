'use client';

import { Settings2 } from 'lucide-react';
import Link from 'next/link';

import { EscalationChainEditor } from '@/components/escalations/escalation-chain-editor';
import { ThresholdConfigPanel } from '@/components/escalations/threshold-config-panel';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SquadGuard } from '@/components/workspace/squad-guard';
import {
  useThresholdConfig,
  useUpdateChains,
  useUpdateThresholds,
} from '@/hooks/use-threshold-config';

export default function EscalationConfigPage() {
  const { data: config, isLoading, error } = useThresholdConfig();
  const updateThresholds = useUpdateThresholds();
  const updateChains = useUpdateChains();

  return (
    <SquadGuard>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
              <Settings2 className="h-8 w-8" />
              Escalation Configuration
            </h1>
            <p className="text-muted-foreground">
              Configure confidence thresholds and escalation chains for your squad.
            </p>
          </div>
          <Link href="/escalations">
            <Button variant="outline" size="sm">
              ← Back to Queue
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">
              Failed to load escalation configuration. Please try again.
            </p>
          </div>
        ) : config ? (
          <>
            <ThresholdConfigPanel
              thresholds={config.thresholds}
              onSave={(thresholds) => updateThresholds.mutate(thresholds)}
              isSaving={updateThresholds.isPending}
            />

            <EscalationChainEditor
              chains={config.chains}
              onSave={(chains) => updateChains.mutate(chains)}
              isSaving={updateChains.isPending}
            />

            {(updateThresholds.isSuccess || updateChains.isSuccess) && (
              <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                ✓ Configuration saved successfully.
              </div>
            )}
            {(updateThresholds.isError || updateChains.isError) && (
              <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                ✗ Failed to save: {updateThresholds.error?.message || updateChains.error?.message}
              </div>
            )}
          </>
        ) : null}
      </div>
    </SquadGuard>
  );
}
