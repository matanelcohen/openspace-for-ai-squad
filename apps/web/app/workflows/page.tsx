'use client';

import type { WorkflowDefinition } from '@matanelcohen/openspace-shared';
import { AlertCircle, GitBranch, Loader2, Play, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { ErrorBoundary } from '@/components/error-boundary';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteWorkflow, useStartExecution, useWorkflows } from '@/hooks/use-workflows';

// ── Workflow Card ────────────────────────────────────────────────

function WorkflowCard({
  workflow,
  onDelete,
  onExecute,
}: {
  workflow: WorkflowDefinition;
  onDelete: (id: string) => void;
  onExecute: (id: string) => void;
}) {
  const nodeCount = workflow.nodes.length;
  const edgeCount = workflow.edges.length;

  return (
    <Card
      className="group transition-all hover:shadow-md"
      data-testid={`workflow-card-${workflow.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <Link href={`/workflows/${workflow.id}`} className="min-w-0 flex-1">
            <CardTitle className="truncate text-base hover:text-primary">{workflow.name}</CardTitle>
          </Link>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onExecute(workflow.id)}
              title="Run workflow"
              data-testid="run-workflow-btn"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive"
              onClick={() => onDelete(workflow.id)}
              title="Delete workflow"
              data-testid="delete-workflow-btn"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            {nodeCount} nodes
          </span>
          <span>{edgeCount} edges</span>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────

function WorkflowListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-5 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function WorkflowsPage() {
  const router = useRouter();
  const { workflows, isLoading, error } = useWorkflows();
  const deleteWorkflow = useDeleteWorkflow();
  const startExecution = useStartExecution();

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeletingId(id);
    deleteWorkflow.mutate(id, {
      onSettled: () => setDeletingId(null),
    });
  };

  const handleExecute = (id: string) => {
    startExecution.mutate(id, {
      onSuccess: () => {
        router.push(`/workflows/${id}`);
      },
    });
  };

  return (
    <ErrorBoundary>
      <div className="space-y-6" data-testid="workflows-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Workflows</h1>
            <p className="text-muted-foreground">Build and monitor DAG workflows for your squad.</p>
          </div>
          <Link href="/workflows/compose">
            <Button data-testid="new-workflow-btn">
              <Plus className="mr-1 h-4 w-4" />
              New Workflow
            </Button>
          </Link>
        </div>

        {/* Error state */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            Failed to load workflows: {error.message}
          </div>
        )}

        {/* Loading */}
        {isLoading && <WorkflowListSkeleton />}

        {/* Empty state */}
        {!isLoading && !error && workflows.length === 0 && (
          <EmptyState
            icon={GitBranch}
            title="No workflows yet"
            description="Create your first workflow to automate squad processes."
            actionLabel="Create Workflow"
            onAction={() => router.push('/workflows/compose')}
          />
        )}

        {/* Workflow grid */}
        {!isLoading && workflows.length > 0 && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {workflows.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onDelete={handleDelete}
                onExecute={handleExecute}
              />
            ))}
          </div>
        )}

        {/* Inline loading indicators */}
        {deletingId && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Deleting workflow…
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
