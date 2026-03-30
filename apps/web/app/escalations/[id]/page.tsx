'use client';

import { useParams } from 'next/navigation';

import { EscalationDetailPanel } from '@/components/escalations/escalation-detail-panel';
import { Skeleton } from '@/components/ui/skeleton';
import { SquadGuard } from '@/components/workspace/squad-guard';
import { useEscalationDetail } from '@/hooks/use-escalation-detail';

export default function EscalationDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: escalation, isLoading, error } = useEscalationDetail(id);

  return (
    <SquadGuard>
      <div className="container mx-auto py-8">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-6 w-96" />
            <div className="grid gap-6 lg:grid-cols-2">
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
            <Skeleton className="h-48" />
          </div>
        ) : error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p className="text-sm text-destructive">
              Failed to load escalation. Please try again.
            </p>
          </div>
        ) : escalation ? (
          <EscalationDetailPanel escalation={escalation} />
        ) : null}
      </div>
    </SquadGuard>
  );
}
