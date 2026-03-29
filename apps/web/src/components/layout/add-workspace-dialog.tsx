'use client';

import { ChevronRight, Folder, FolderGit2, FolderOpen, Plus, Users } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { EmojiPicker } from '@/components/ui/emoji-picker';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { useActivateWorkspace, useCreateWorkspace } from '@/hooks/use-workspaces';

interface BrowseEntry {
  name: string;
  path: string;
  hasSquad: boolean;
  hasGit: boolean;
}

interface BrowseResult {
  current: string;
  parent: string;
  name: string;
  dirs: BrowseEntry[];
}

interface AddWorkspaceDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddWorkspaceDialog({ open: externalOpen, onOpenChange: externalOnOpenChange }: AddWorkspaceDialogProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const [name, setName] = useState('');
  const [projectDir, setProjectDir] = useState('');
  const [icon, setIcon] = useState('🚀');
  const [browsing, setBrowsing] = useState(false);
  const [browseData, setBrowseData] = useState<BrowseResult | null>(null);
  const [browseLoading, setBrowseLoading] = useState(false);

  const createWorkspace = useCreateWorkspace();
  const activateWorkspace = useActivateWorkspace();

  const browse = useCallback(async (path?: string) => {
    setBrowseLoading(true);
    try {
      const query = path ? `?path=${encodeURIComponent(path)}` : '';
      const data = await api.get<BrowseResult>(`/api/workspaces/browse${query}`);
      setBrowseData(data);
      setBrowsing(true);
    } catch {
      // ignore
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const selectDir = (entry: BrowseEntry) => {
    setProjectDir(entry.path);
    if (!name.trim()) {
      setName(entry.name);
    }
    setBrowsing(false);
  };

  const setOpen = (v: boolean) => {
    if (isControlled) {
      externalOnOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
    if (!v) setBrowsing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !projectDir.trim()) return;

    try {
      const workspace = await createWorkspace.mutateAsync({
        name: name.trim(),
        projectDir: projectDir.trim(),
        icon: icon || '🚀',
      });
      await activateWorkspace.mutateAsync(workspace.id);
      setOpen(false);
      setName('');
      setProjectDir('');
      setIcon('🚀');
    } catch {
      // Error handled by React Query
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
            <Plus className="h-4 w-4" />
            Add Workspace
          </button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg w-[95vw]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Workspace</DialogTitle>
            <DialogDescription>Connect another project to manage from this UI.</DialogDescription>
          </DialogHeader>

          {browsing && browseData ? (
            <div className="mt-4 space-y-3">
              {/* Current path + navigation */}
              <div className="space-y-2">
                <div className="rounded-md bg-muted px-3 py-2">
                  <span className="block break-all text-xs font-mono text-muted-foreground">{browseData.current}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => browse(browseData.parent)}
                  >
                    ← Up
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => selectDir({ name: browseData.name, path: browseData.current, hasSquad: false, hasGit: false })}
                  >
                    ✓ Use This Folder
                  </Button>
                </div>
              </div>

              {/* Directory list */}
              <div className="max-h-[50vh] overflow-y-auto rounded-md border">
                {browseData.dirs.length === 0 ? (
                  <p className="p-6 text-center text-sm text-muted-foreground">No subdirectories</p>
                ) : (
                  browseData.dirs.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      className="flex w-full items-center gap-3 border-b px-3 py-3 text-left last:border-0 hover:bg-muted/50 active:bg-muted transition-colors"
                      onClick={() => browse(entry.path)}
                    >
                      {entry.hasSquad ? (
                        <Users className="h-5 w-5 shrink-0 text-primary" />
                      ) : entry.hasGit ? (
                        <FolderGit2 className="h-5 w-5 shrink-0 text-orange-500" />
                      ) : (
                        <Folder className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="block truncate text-sm font-medium">{entry.name}</span>
                        {(entry.hasSquad || entry.hasGit) && (
                          <div className="flex gap-1.5 mt-0.5">
                            {entry.hasSquad && (
                              <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">.squad</span>
                            )}
                            {entry.hasGit && (
                              <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-medium text-orange-600 dark:text-orange-400">.git</span>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  ))
                )}
              </div>

              <Button type="button" variant="ghost" size="sm" onClick={() => setBrowsing(false)} className="w-full">
                ← Back to form
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <label htmlFor="ws-name" className="text-sm font-medium">Name</label>
                <Input id="ws-name" placeholder="my-project" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label htmlFor="ws-path" className="text-sm font-medium">Project Path</label>
                <div className="flex gap-2">
                  <Input id="ws-path" placeholder="/home/user/repos/my-project" value={projectDir} onChange={(e) => setProjectDir(e.target.value)} required className="flex-1" />
                  <Button type="button" variant="outline" onClick={() => browse(projectDir || undefined)} disabled={browseLoading}>
                    <FolderOpen className="mr-1 h-4 w-4" />
                    Browse
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Icon</label>
                <EmojiPicker value={icon} onChange={setIcon} />
              </div>
            </div>
          )}

          {!browsing && (
            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createWorkspace.isPending || !name.trim() || !projectDir.trim()}>
                {createWorkspace.isPending ? 'Adding…' : 'Add Workspace'}
              </Button>
            </DialogFooter>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
