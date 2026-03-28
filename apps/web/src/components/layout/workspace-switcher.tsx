'use client';

import { Check, ChevronsUpDown } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useActivateWorkspace, useActiveWorkspace, useWorkspaces } from '@/hooks/use-workspaces';

import { AddWorkspaceDialog } from './add-workspace-dialog';

export function WorkspaceSwitcher() {
  const { data: workspaces = [] } = useWorkspaces();
  const { data: active } = useActiveWorkspace();
  const activateWorkspace = useActivateWorkspace();

  const handleSwitch = async (id: string) => {
    if (id === active?.id) return;
    await activateWorkspace.mutateAsync(id);
    window.location.reload();
  };

  const displayName = active?.name ?? 'openspace.ai';
  const displayIcon = active?.icon ?? '🚀';

  return (
    <div className="border-b px-3 py-3">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2.5 rounded-lg border bg-background px-3 py-2 text-left shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-base">
            {displayIcon}
          </span>
          <div className="flex-1 min-w-0">
            <div className="truncate text-sm font-semibold">{displayName}</div>
            <div className="truncate text-[11px] text-muted-foreground">
              {workspaces.length} workspace{workspaces.length !== 1 ? 's' : ''}
            </div>
          </div>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Workspaces</div>
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => handleSwitch(ws.id)}
              className="flex items-center gap-2.5 px-2 py-2"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-sm">
                {ws.icon ?? '🚀'}
              </span>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">{ws.name}</div>
              </div>
              {ws.id === active?.id && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                  <Check className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <AddWorkspaceDialog />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
