'use client';

import type { Workspace } from '@openspace/shared';
import { Check, ChevronsUpDown, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { Input } from '@/components/ui/input';
import {
  getStoredWorkspaceId,
  useActivateWorkspace,
  useActiveWorkspace,
  useDeleteWorkspace,
  useUpdateWorkspace,
  useWorkspaces,
} from '@/hooks/use-workspaces';

import { AddWorkspaceDialog } from './add-workspace-dialog';

export function WorkspaceSwitcher() {
  const { data: workspaces = [] } = useWorkspaces();
  const { data: active } = useActiveWorkspace();
  const activateWorkspace = useActivateWorkspace();
  const updateWorkspace = useUpdateWorkspace();
  const deleteWorkspace = useDeleteWorkspace();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(null);
  const [editName, setEditName] = useState('');
  const [editIcon, setEditIcon] = useState('');

  // Restore last workspace from localStorage on first load
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current || !workspaces.length || !active) return;
    restoredRef.current = true;
    const storedId = getStoredWorkspaceId();
    if (storedId && storedId !== active.id && workspaces.some((w) => w.id === storedId)) {
      // Activate on API then reload to get fresh data
      activateWorkspace.mutateAsync(storedId).then(() => {
        window.location.reload();
      }).catch(() => { /* ignore */ });
    }
  }, [workspaces, active, activateWorkspace]);

  const handleSwitch = async (id: string) => {
    if (id === active?.id) return;
    setDropdownOpen(false);
    await activateWorkspace.mutateAsync(id);
    window.location.reload();
  };

  const openEdit = (ws: Workspace) => {
    setEditName(ws.name);
    setEditIcon(ws.icon ?? '🚀');
    setEditingWorkspace(ws);
    setDropdownOpen(false);
  };

  const openDelete = (ws: Workspace) => {
    setDeletingWorkspace(ws);
    setDropdownOpen(false);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkspace || !editName.trim()) return;
    await updateWorkspace.mutateAsync({
      id: editingWorkspace.id,
      name: editName.trim(),
      icon: editIcon || '🚀',
    });
    setEditingWorkspace(null);
  };

  const handleDelete = async () => {
    if (!deletingWorkspace) return;
    const wasActive = deletingWorkspace.id === active?.id;
    const deletedId = deletingWorkspace.id;
    await deleteWorkspace.mutateAsync(deletedId);
    setDeletingWorkspace(null);
    if (wasActive) {
      const remaining = workspaces.filter((w) => w.id !== deletedId);
      const next = remaining[0];
      if (next) {
        await activateWorkspace.mutateAsync(next.id);
      }
      window.location.reload();
    }
  };

  const displayName = active?.name ?? 'openspace.ai';
  const displayIcon = active?.icon ?? '🚀';

  return (
    <>
      <div className="border-b px-3 py-3">
        <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
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
              <div
                key={ws.id}
                role="menuitem"
                tabIndex={-1}
                className="relative flex items-center gap-2.5 rounded-sm px-2 py-2 text-sm outline-none transition-colors hover:bg-accent cursor-pointer group"
                onClick={() => handleSwitch(ws.id)}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-sm">
                  {ws.icon ?? '🚀'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-sm font-medium">{ws.name}</div>
                </div>
                {ws.id === active?.id && (
                  <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
                <div
                  className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => openEdit(ws)}
                    className="rounded p-1 hover:bg-muted-foreground/10"
                    title="Edit workspace"
                  >
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => openDelete(ws)}
                    className="rounded p-1 hover:bg-destructive/10"
                    title="Delete workspace"
                  >
                    <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              </div>
            ))}
            <DropdownMenuSeparator />
            <AddWorkspaceDialog />
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit workspace dialog */}
      <Dialog open={!!editingWorkspace} onOpenChange={(v) => { if (!v) setEditingWorkspace(null); }}>
        <DialogContent>
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle>Edit Workspace</DialogTitle>
              <DialogDescription>Rename your workspace or change its icon.</DialogDescription>
            </DialogHeader>
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label htmlFor="edit-ws-name" className="text-sm font-medium">Name</label>
                <Input
                  id="edit-ws-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Workspace name"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Icon</label>
                <EmojiPicker value={editIcon} onChange={setEditIcon} />
              </div>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setEditingWorkspace(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateWorkspace.isPending || !editName.trim()}>
                {updateWorkspace.isPending ? 'Saving…' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete workspace confirmation */}
      <AlertDialog open={!!deletingWorkspace} onOpenChange={(v) => { if (!v) setDeletingWorkspace(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingWorkspace?.id === active?.id
                ? `"${deletingWorkspace?.name}" is the currently active workspace. Deleting it will switch you to another workspace.`
                : `Are you sure you want to delete "${deletingWorkspace?.name}"? This will remove the workspace from the list but won't delete any files.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteWorkspace.isPending ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
