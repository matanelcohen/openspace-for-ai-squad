'use client';

import { Plus } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SquadInitWizard } from '@/components/workspace/squad-init-wizard';
import { useActiveWorkspace, useWorkspaces, useWorkspaceStatus } from '@/hooks/use-workspaces';

import { AddWorkspaceDialog } from './add-workspace-dialog';
import { Sidebar } from './sidebar';
import { TopBar } from './top-bar';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const pathname = usePathname();

  const { data: workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const { data: workspace } = useActiveWorkspace();
  const { data: status, isLoading: statusLoading } = useWorkspaceStatus(workspace?.id);

  const hasNoWorkspaces = !workspacesLoading && workspaces !== undefined && workspaces.length === 0;
  const squadMissing = !statusLoading && workspace && status && !status.initialized;

  // Auto-open add workspace dialog when there are zero workspaces
  useEffect(() => {
    if (hasNoWorkspaces) setAddDialogOpen(true);
  }, [hasNoWorkspaces]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  // No workspaces at all — show welcome screen with add dialog
  if (hasNoWorkspaces) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="max-w-lg w-full px-6 text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">🚀 openspace.ai</h1>
            <p className="text-muted-foreground">Welcome! Add your first workspace to get started.</p>
          </div>
          <Button onClick={() => setAddDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Workspace
          </Button>
        </div>
        <AddWorkspaceDialog open={addDialogOpen} onOpenChange={setAddDialogOpen} />
      </div>
    );
  }

  // When squad is not initialized, show full-screen welcome
  if (squadMissing) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="max-w-lg w-full px-6 text-center space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">🚀 openspace.ai</h1>
            <p className="text-muted-foreground">
              Welcome to <span className="font-semibold">{workspace.name}</span>
            </p>
          </div>

          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h2 className="text-lg font-semibold">No squad configured</h2>
            <p className="text-sm text-muted-foreground">
              This workspace doesn&apos;t have a <code>.squad/</code> directory yet.
              Initialize one to set up your AI agent team.
            </p>
            <button
              onClick={() => setWizardOpen(true)}
              className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
            >
              ✨ Initialize Squad
            </button>
          </div>

          <p className="text-xs text-muted-foreground">
            Or run <code className="bg-muted px-1.5 py-0.5 rounded text-xs">squad init</code> from the terminal.
          </p>
        </div>

        <SquadInitWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          workspaceId={workspace.id}
          workspaceName={workspace.name}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden="true"
        />
      )}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-200 ease-in-out lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <Sidebar onNavigate={closeSidebar} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6" role="main">
          {children}
        </main>
      </div>
    </div>
  );
}
