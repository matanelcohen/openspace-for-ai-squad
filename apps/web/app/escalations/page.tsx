'use client';

import { useState } from 'react';

import { BulkActionToolbar } from '@/components/escalations/bulk-action-toolbar';
import { ReviewQueueTable } from '@/components/escalations/review-queue-table';
import { Skeleton } from '@/components/ui/skeleton';
import { SquadGuard } from '@/components/workspace/squad-guard';
import { useEscalations } from '@/hooks/use-escalations';

export default function EscalationsPage() {
  const { data: escalations, isLoading, error } = useEscalations();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  return (
    <SquadGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Escalations</h1>
          <p className="text-muted-foreground">
            Review and act on human-in-the-loop escalations from agents.
          </p>
        </div>

        <BulkActionToolbar
          selectedIds={selectedIds}
          onClearSelection={() => setSelectedIds(new Set())}
        />

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">
              Failed to load escalations. Please try again.
            </p>
          </div>
        ) : (
          <ReviewQueueTable
            escalations={escalations ?? []}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
          />
        )}
      </div>
    </SquadGuard>
  );
}
