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

export function AddWorkspaceDialog() {
  const [open, setOpen] = useState(false);
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
      setBrowsing(false);
    } catch {
      // Error handled by React Query
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setBrowsing(false); }}>
      <DialogTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <Plus className="h-4 w-4" />
          Add Workspace
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Workspace</DialogTitle>
            <DialogDescription>Connect another project to manage from this UI.</DialogDescription>
          </DialogHeader>

          {browsing && browseData ? (
            <div className="mt-4 space-y-2">
              {/* Breadcrumb */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <button type="button" onClick={() => browse(browseData.parent)} className="hover:text-foreground">
                  ↑ Parent
                </button>
                <span className="mx-1">|</span>
                <span className="truncate font-mono">{browseData.current}</span>
              </div>

              {/* Directory list */}
              <div className="max-h-64 overflow-y-auto rounded-md border">
                {browseData.dirs.length === 0 ? (
                  <p className="p-4 text-center text-sm text-muted-foreground">No subdirectories</p>
                ) : (
                  browseData.dirs.map((entry) => (
                    <div
                      key={entry.path}
                      className="flex items-center gap-2 border-b px-3 py-2 last:border-0 hover:bg-muted/50"
                    >
                      {entry.hasSquad ? (
                        <Users className="h-4 w-4 shrink-0 text-primary" />
                      ) : entry.hasGit ? (
                        <FolderGit2 className="h-4 w-4 shrink-0 text-orange-500" />
                      ) : (
                        <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate text-sm">{entry.name}</span>
                      {entry.hasSquad && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">.squad</span>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={() => selectDir(entry)}
                      >
                        Select
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => browse(entry.path)}
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <Button type="button" variant="outline" size="sm" onClick={() => setBrowsing(false)}>
                Back to form
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
                <label htmlFor="ws-icon" className="text-sm font-medium">Icon</label>
                <Input id="ws-icon" placeholder="🚀" value={icon} onChange={(e) => setIcon(e.target.value)} className="w-20" />
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
