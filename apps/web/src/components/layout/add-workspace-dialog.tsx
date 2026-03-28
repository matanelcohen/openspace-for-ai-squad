'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

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
import { useActivateWorkspace, useCreateWorkspace } from '@/hooks/use-workspaces';

export function AddWorkspaceDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [projectDir, setProjectDir] = useState('');
  const [icon, setIcon] = useState('🚀');

  const createWorkspace = useCreateWorkspace();
  const activateWorkspace = useActivateWorkspace();

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
      <DialogTrigger asChild>
        <button className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground">
          <Plus className="h-4 w-4" />
          Add Workspace
        </button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Workspace</DialogTitle>
            <DialogDescription>Connect another project to manage from this UI.</DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <label htmlFor="ws-name" className="text-sm font-medium">
                Name
              </label>
              <Input
                id="ws-name"
                placeholder="my-project"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ws-path" className="text-sm font-medium">
                Project Path
              </label>
              <Input
                id="ws-path"
                placeholder="/home/user/repos/my-project"
                value={projectDir}
                onChange={(e) => setProjectDir(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="ws-icon" className="text-sm font-medium">
                Icon
              </label>
              <Input
                id="ws-icon"
                placeholder="🚀"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-20"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createWorkspace.isPending || !name.trim() || !projectDir.trim()}
            >
              {createWorkspace.isPending ? 'Adding…' : 'Add Workspace'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
