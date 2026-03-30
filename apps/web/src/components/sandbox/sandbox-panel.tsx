'use client';

import type { Sandbox, SandboxRuntime } from '@openspace/shared';
import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSandboxStream } from '@/hooks/use-sandbox-stream';
import {
  useCreateSandbox,
  useDestroySandbox,
  useRunCommand,
  useSandboxes,
  useStopSandbox,
} from '@/hooks/use-sandboxes';
import { cn } from '@/lib/utils';

import { CommandInput } from './command-input';
import { RuntimeSelector } from './runtime-selector';
import { SandboxControls } from './sandbox-controls';
import { SandboxList } from './sandbox-list';
import { TerminalOutput } from './terminal-output';

interface SandboxPanelProps {
  className?: string;
}

export function SandboxPanel({ className }: SandboxPanelProps) {
  const { data: sandboxes = [], isLoading } = useSandboxes();
  const createSandbox = useCreateSandbox();
  const runCommand = useRunCommand();
  const stopSandbox = useStopSandbox();
  const destroySandbox = useDestroySandbox();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newRuntime, setNewRuntime] = useState<SandboxRuntime>('node');
  const [isCreating, setIsCreating] = useState(false);

  const selected = sandboxes.find((s) => s.id === selectedId) ?? null;
  const { lines, isStreaming, status: streamStatus, reconnectAttempt, clear, retry } = useSandboxStream(selectedId);

  const handleSelect = useCallback((sandbox: Sandbox) => {
    setSelectedId(sandbox.id);
  }, []);

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    createSandbox.mutate(
      { name: newName.trim(), runtime: newRuntime },
      {
        onSuccess: (sandbox) => {
          setSelectedId(sandbox.id);
          setNewName('');
          setIsCreating(false);
        },
      },
    );
  }, [newName, newRuntime, createSandbox]);

  const handleRunCommand = useCallback(
    (command: string) => {
      if (!selectedId) return;
      runCommand.mutate({ sandboxId: selectedId, command });
    },
    [selectedId, runCommand],
  );

  const handleStop = useCallback(() => {
    if (!selectedId) return;
    stopSandbox.mutate(selectedId);
  }, [selectedId, stopSandbox]);

  const handleDestroy = useCallback(() => {
    if (!selectedId) return;
    destroySandbox.mutate(selectedId, {
      onSuccess: () => setSelectedId(null),
    });
  }, [selectedId, destroySandbox]);

  return (
    <div className={cn('flex h-full', className)} data-testid="sandbox-panel">
      {/* ── Left sidebar: sandbox list ── */}
      <div className="flex w-72 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h2 className="text-sm font-semibold">Sandboxes</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsCreating(!isCreating)}
            data-testid="sandbox-create-toggle"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Create sandbox form */}
        {isCreating && (
          <div className="space-y-2 border-b p-3">
            <Input
              placeholder="Sandbox name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              className="h-9 text-sm"
              data-testid="sandbox-name-input"
            />
            <div className="flex items-center gap-2">
              <RuntimeSelector value={newRuntime} onValueChange={setNewRuntime} />
              <Button
                size="sm"
                className="h-9 flex-1"
                onClick={handleCreate}
                disabled={!newName.trim() || createSandbox.isPending}
                data-testid="sandbox-create-submit"
              >
                {createSandbox.isPending ? 'Creating…' : 'Create'}
              </Button>
            </div>
          </div>
        )}

        <SandboxList
          sandboxes={sandboxes}
          selectedId={selectedId}
          onSelect={handleSelect}
          isLoading={isLoading}
        />
      </div>

      {/* ── Right: terminal area ── */}
      <div className="flex flex-1 flex-col min-w-0">
        {selected ? (
          <>
            {/* Header bar */}
            <div className="flex items-center justify-between border-b px-4 py-2">
              <div className="flex items-center gap-3 min-w-0">
                <h3 className="truncate text-sm font-semibold">{selected.name}</h3>
                <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs">
                  {selected.image}
                </span>
                {selected.port && (
                  <span className="shrink-0 text-xs text-muted-foreground">:{selected.port}</span>
                )}
              </div>
              <SandboxControls
                status={selected.status}
                onRun={() => {
                  /* focus command input */
                }}
                onStop={handleStop}
                onDestroy={handleDestroy}
                isStopping={stopSandbox.isPending}
                isDestroying={destroySandbox.isPending}
              />
            </div>

            {/* Stream connection status */}
            {streamStatus === 'reconnecting' && (
              <div className="flex items-center gap-2 border-b border-yellow-500/30 bg-yellow-950/30 px-4 py-1.5 text-xs text-yellow-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
                Reconnecting to sandbox stream… (attempt {reconnectAttempt}/10)
              </div>
            )}
            {streamStatus === 'failed' && (
              <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-950/40 px-4 py-1.5 text-xs text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500" />
                <span>Unable to reach the sandbox — is the API server running?</span>
                <button
                  onClick={retry}
                  className="ml-auto rounded border border-red-500/40 bg-red-950/60 px-2 py-0.5 text-xs text-red-300 transition-colors hover:bg-red-900/60"
                >
                  Retry
                </button>
              </div>
            )}

            {/* Terminal viewer */}
            <TerminalOutput
              lines={lines}
              isStreaming={isStreaming}
              onClear={clear}
              className="flex-1 min-h-0"
            />

            {/* Command input */}
            <div className="border-t p-2">
              <CommandInput
                onSubmit={handleRunCommand}
                disabled={selected.status !== 'running' || runCommand.isPending}
                placeholder={
                  selected.status !== 'running' ? 'Sandbox is not running' : '$ enter command…'
                }
              />
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <div className="text-center">
              <p className="text-sm">Select a sandbox to view its terminal</p>
              <p className="mt-1 text-xs">or create a new one to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
