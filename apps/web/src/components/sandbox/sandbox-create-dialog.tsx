'use client';

import type { SandboxRuntime } from '@openspace/shared';

import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { RuntimeSelector } from './runtime-selector';
import { SANDBOX_TEMPLATES } from './sandbox-templates';

interface SandboxCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: {
    name: string;
    runtime: SandboxRuntime;
    templateId?: string;
    setupCommand?: string;
  }) => void;
  isPending?: boolean;
  initialTemplateId?: string;
  className?: string;
}

export function SandboxCreateDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  initialTemplateId,
  className,
}: SandboxCreateDialogProps) {
  const initialTemplate = SANDBOX_TEMPLATES.find((t) => t.id === initialTemplateId);

  const [name, setName] = useState(initialTemplate?.name ?? '');
  const [runtime, setRuntime] = useState<SandboxRuntime>(initialTemplate?.runtime ?? 'node');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>(
    initialTemplateId,
  );

  const selectedTemplate = SANDBOX_TEMPLATES.find((t) => t.id === selectedTemplateId);

  const handleTemplateClick = useCallback((templateId: string) => {
    const tpl = SANDBOX_TEMPLATES.find((t) => t.id === templateId);
    if (tpl) {
      setSelectedTemplateId(tpl.id);
      setRuntime(tpl.runtime);
      if (!name.trim()) setName(tpl.name);
    }
  }, [name]);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({
      name: trimmed,
      runtime,
      templateId: selectedTemplateId,
      setupCommand: selectedTemplate?.setupCommand,
    });
  }, [name, runtime, selectedTemplateId, selectedTemplate, onSubmit]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn('sm:max-w-lg', className)} data-testid="sandbox-create-dialog">
        <DialogHeader>
          <DialogTitle>Create Sandbox</DialogTitle>
          <DialogDescription>
            Choose a template or configure a blank environment.
          </DialogDescription>
        </DialogHeader>

        {/* Template selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Template</label>
          <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
            {SANDBOX_TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                onClick={() => handleTemplateClick(tpl.id)}
                className={cn(
                  'flex items-center gap-2 rounded-md border p-2 text-left text-sm transition-colors',
                  'hover:border-primary/50 hover:bg-accent',
                  selectedTemplateId === tpl.id && 'border-primary bg-accent ring-1 ring-primary',
                )}
                data-testid={`dialog-template-${tpl.id}`}
              >
                <span className="text-base">{tpl.icon}</span>
                <div className="min-w-0">
                  <p className="font-medium truncate">{tpl.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{tpl.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Name + runtime */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label htmlFor="sandbox-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="sandbox-name"
              placeholder="my-sandbox"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              data-testid="dialog-sandbox-name"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Runtime</label>
            <RuntimeSelector value={runtime} onValueChange={setRuntime} />
          </div>

          {selectedTemplate?.setupCommand && (
            <div className="rounded-md bg-muted p-2 font-mono text-xs text-muted-foreground">
              <p className="mb-1 text-[10px] uppercase tracking-wider font-semibold">
                Setup command
              </p>
              <code className="break-all">{selectedTemplate.setupCommand}</code>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || isPending}
            data-testid="dialog-create-submit"
          >
            {isPending ? 'Creating…' : 'Create Sandbox'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
