'use client';

import { Rocket } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { SquadInitWizard } from '@/components/workspace/squad-init-wizard';
import { useActiveWorkspace, useWorkspaceStatus } from '@/hooks/use-workspaces';

interface SquadGuardProps {
  children: React.ReactNode;
}

/**
 * Wraps page content and shows a "squad not initialized" prompt
 * when the active workspace has no `.squad/` configured.
 */
export function SquadGuard({ children }: SquadGuardProps) {
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
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          <Rocket className="h-6 w-6 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold mb-1">Squad not initialized</h2>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          Initialize a squad for this project before using this feature.
        </p>
        <Button onClick={() => setWizardOpen(true)}>
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
    );
  }

  return <>{children}</>;
}
