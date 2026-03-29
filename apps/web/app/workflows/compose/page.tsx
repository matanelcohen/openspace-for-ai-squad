'use client';

import type { WorkflowDefinition } from '@openspace/shared';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { WorkflowComposer } from '@/components/workflow/workflow-composer';
import { useCreateWorkflow } from '@/hooks/use-workflows';

export default function WorkflowComposePage() {
  const router = useRouter();
  const createWorkflow = useCreateWorkflow();
  const [saved, setSaved] = useState(false);

  const handleSave = (definition: WorkflowDefinition) => {
    createWorkflow.mutate(definition, {
      onSuccess: () => {
        setSaved(true);
        setTimeout(() => {
          router.push(`/workflows/${definition.id}`);
        }, 1000);
      },
    });
  };

  return (
    <div className="space-y-6" data-testid="workflow-compose-page">
      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/workflows"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          data-testid="back-to-workflows"
        >
          <ArrowLeft className="h-4 w-4" /> Back to workflows
        </Link>

        {saved && (
          <div className="flex items-center gap-1.5 text-sm text-green-600">
            <CheckCircle2 className="h-4 w-4" />
            Workflow saved! Redirecting…
          </div>
        )}
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Compose Workflow</h1>
        <p className="text-muted-foreground">
          Drag nodes from the palette and connect them to build a pipeline.
        </p>
      </div>

      {/* Composer */}
      <WorkflowComposer onSave={handleSave} />
    </div>
  );
}
