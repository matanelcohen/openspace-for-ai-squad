'use client';

import { ArrowLeft, Play } from 'lucide-react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { WorkflowViewer } from '@/components/workflow/workflow-viewer';
import { WorkflowStatusBadge } from '@/components/workflow/workflow-status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useWorkflow } from '@/hooks/use-workflow';
import { useStartExecution } from '@/hooks/use-workflows';

export default function WorkflowDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();

  const workflowId = params.id as string;
  const executionId = searchParams.get('executionId') ?? undefined;

  const { definition, executionState, isLoading, error, isConnected } = useWorkflow({
    workflowId,
    executionId,
    realtime: true,
  });

  const startExecution = useStartExecution();
  const [runningExecutionId, setRunningExecutionId] = useState<string | undefined>(executionId);

  const handleRun = () => {
    startExecution.mutate(workflowId, {
      onSuccess: (result) => {
        setRunningExecutionId(result.executionId);
      },
    });
  };

  // Use the running execution if available
  const { executionState: liveExecState } = useWorkflow({
    workflowId,
    executionId: runningExecutionId,
    realtime: true,
  });

  const activeExecution = liveExecState ?? executionState;

  if (isLoading) {
    return (
      <div className="space-y-6" data-testid="workflow-detail-loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error || !definition) {
    return (
      <div className="space-y-4" data-testid="workflow-detail-error">
        <Link
          href="/workflows"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to workflows
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
          <p className="text-sm text-destructive">
            {error ? `Failed to load workflow: ${error.message}` : 'Workflow not found.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="workflow-detail-page">
      {/* Navigation */}
      <Link
        href="/workflows"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        data-testid="back-to-workflows"
      >
        <ArrowLeft className="h-4 w-4" /> Back to workflows
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight" data-testid="workflow-title">
            {definition.name}
          </h1>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{definition.nodes.length} nodes</span>
            <span>{definition.edges.length} edges</span>
            {activeExecution && (
              <WorkflowStatusBadge status={activeExecution.status} />
            )}
            {isConnected && (
              <span className="flex items-center gap-1 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                Live
              </span>
            )}
          </div>
        </div>
        <Button
          onClick={handleRun}
          disabled={startExecution.isPending}
          data-testid="run-workflow-btn"
        >
          <Play className="mr-1 h-4 w-4" />
          {startExecution.isPending ? 'Starting…' : 'Run'}
        </Button>
      </div>

      {/* Workflow DAG Viewer */}
      <WorkflowViewer
        definition={definition}
        executionState={activeExecution}
        className="h-[650px]"
      />

      {/* Execution metadata */}
      {activeExecution && (
        <div className="rounded-lg border bg-card p-4" data-testid="execution-info">
          <h2 className="mb-3 text-sm font-semibold">Execution Details</h2>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs sm:grid-cols-4">
            <div>
              <span className="text-muted-foreground">Execution ID</span>
              <p className="font-mono">{activeExecution.executionId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status</span>
              <div className="mt-0.5">
                <WorkflowStatusBadge status={activeExecution.status} />
              </div>
            </div>
            <div>
              <span className="text-muted-foreground">Started</span>
              <p>{new Date(activeExecution.createdAt).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Last Updated</span>
              <p>{new Date(activeExecution.updatedAt).toLocaleString()}</p>
            </div>
          </div>

          {/* Per-node status table */}
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Node Status</h3>
            <div className="space-y-1">
              {Object.entries(activeExecution.nodeStates).map(([nodeId, _nodeState]) => {
                const nodeState = _nodeState as { startedAt?: string; completedAt?: string; status?: string };
                const node = definition.nodes.find((n: { id: string }) => n.id === nodeId);
                return (
                  <div
                    key={nodeId}
                    className="flex items-center justify-between rounded-md border px-3 py-1.5 text-xs"
                    data-testid={`node-row-${nodeId}`}
                  >
                    <span className="font-medium">{node?.label ?? nodeId}</span>
                    <div className="flex items-center gap-3">
                      {nodeState.startedAt && (
                        <span className="text-muted-foreground tabular-nums">
                          {nodeState.completedAt
                            ? `${((new Date(nodeState.completedAt).getTime() - new Date(nodeState.startedAt).getTime()) / 1000).toFixed(1)}s`
                            : 'running…'}
                        </span>
                      )}
                      <span
                        className={
                          nodeState.status === 'completed'
                            ? 'text-green-600'
                            : nodeState.status === 'failed'
                              ? 'text-red-600'
                              : nodeState.status === 'running'
                                ? 'text-blue-600'
                                : nodeState.status === 'paused'
                                  ? 'text-yellow-600'
                                  : 'text-muted-foreground'
                        }
                      >
                        {nodeState.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
