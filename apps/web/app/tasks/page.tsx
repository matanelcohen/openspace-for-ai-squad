'use client';

import { LayoutGrid, List, Plus } from 'lucide-react';
import { useState } from 'react';

import { ErrorBoundary } from '@/components/error-boundary';
import { KanbanBoard } from '@/components/tasks/kanban-board';
import { TaskFormDialog } from '@/components/tasks/task-form-dialog';
import { TaskListView } from '@/components/tasks/task-list-view';
import { Button } from '@/components/ui/button';
import { SquadGuard } from '@/components/workspace/squad-guard';

type ViewMode = 'board' | 'list';

export default function TasksPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('board');
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <ErrorBoundary>
      <SquadGuard>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
              <p className="text-muted-foreground">Manage and prioritize squad work.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-md border" data-testid="view-toggle">
                <Button
                  variant={viewMode === 'board' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('board')}
                  aria-label="Board view"
                  data-testid="view-toggle-board"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  data-testid="view-toggle-list"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Button onClick={() => setDialogOpen(true)} data-testid="create-task-btn">
                <Plus className="mr-1 h-4 w-4" />
                New Task
              </Button>
            </div>
          </div>

          {viewMode === 'board' ? <KanbanBoard /> : <TaskListView />}

          <TaskFormDialog open={dialogOpen} onOpenChange={setDialogOpen} />
        </div>
      </SquadGuard>
    </ErrorBoundary>
  );
}
