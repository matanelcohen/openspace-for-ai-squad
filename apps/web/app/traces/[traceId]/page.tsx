'use client';

import { TraceDetail } from '@/components/traces/trace-detail';

interface TraceDetailPageProps {
  params: { traceId: string };
}

export default function TraceDetailPage({ params }: TraceDetailPageProps) {
  return (
    <div className="h-[calc(100vh-8rem)]">
      <TraceDetail traceId={params.traceId} />
    </div>
  );
}
