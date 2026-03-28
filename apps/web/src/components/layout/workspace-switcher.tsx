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
    // Reload to show the new workspace's data
    window.location.reload();
  };

  // Single workspace — just show name, no dropdown
  if (workspaces.length <= 1) {
    return (
      <div className="flex h-14 items-center border-b px-4">
        <div className="flex items-center gap-2 font-semibold">
          <span className="text-lg">{active?.icon ?? '🚀'}</span>
          <span className="truncate">{active?.name ?? 'openspace.ai'}</span>
        </div>
      </div>
    );
  }

  // Multiple workspaces — show dropdown
  return (
    <div className="flex h-14 items-center border-b px-4">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left font-semibold transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <span className="text-lg">{active?.icon ?? '🚀'}</span>
          <span className="flex-1 truncate text-sm">{active?.name ?? 'openspace.ai'}</span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          {workspaces.map((ws) => (
            <DropdownMenuItem
              key={ws.id}
              onClick={() => handleSwitch(ws.id)}
              className="flex items-center gap-2"
            >
              <span className="text-base">{ws.icon ?? '🚀'}</span>
              <span className="flex-1 truncate">{ws.name}</span>
              {ws.id === active?.id && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <AddWorkspaceDialog />
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
