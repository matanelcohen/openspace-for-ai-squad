'use client';

import type { Sandbox } from '@openspace/shared';
import { Box } from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';

import { SandboxCard } from './sandbox-card';

interface SandboxListProps {
  sandboxes: Sandbox[];
  selectedId: string | null;
  onSelect: (sandbox: Sandbox) => void;
  isLoading?: boolean;
}

export function SandboxList({ sandboxes, selectedId, onSelect, isLoading }: SandboxListProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted/50" />
        ))}
      </div>
    );
  }

  if (sandboxes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
        <Box className="h-10 w-10 opacity-30" />
        <p className="text-sm">No active sandboxes</p>
        <p className="text-xs">Create a sandbox to get started</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-3" data-testid="sandbox-list">
        {sandboxes.map((sandbox) => (
          <SandboxCard
            key={sandbox.id}
            sandbox={sandbox}
            isSelected={sandbox.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
