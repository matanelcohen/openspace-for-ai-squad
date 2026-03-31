// @ts-nocheck
'use client';

import type { Sandbox, SandboxFile } from '@matanelcohen/openspace-shared';
import { ArrowLeft, Code2, Files, Terminal as TerminalIcon } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { useSandboxStream } from '@/hooks/use-sandbox-stream';
import { useRunCommand, useStopSandbox, useDestroySandbox } from '@/hooks/use-sandboxes';
import { useSandboxFiles } from '@/hooks/use-sandbox-files';
import { useRunCode } from '@/hooks/use-run-code';
import { cn } from '@/lib/utils';

import { CodeEditor } from './code-editor';
import { CommandInput } from './command-input';
import { FileExplorer } from './file-explorer';
import { SandboxControls } from './sandbox-controls';
import { SandboxStatusBar } from './sandbox-status-bar';
import { TerminalOutput } from './terminal-output';

import type { Language } from '@/hooks/use-run-code';

type Tab = 'terminal' | 'editor' | 'files';

interface SandboxIdeProps {
  sandbox: Sandbox;
  className?: string;
}

export function SandboxIde({ sandbox, className }: SandboxIdeProps) {
  const [activeTab, setActiveTab] = useState<Tab>('editor');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const { lines, isStreaming, status: streamStatus, reconnectAttempt, clear, retry } =
    useSandboxStream(sandbox.id);
  const runCommand = useRunCommand();
  const stopSandbox = useStopSandbox();
  const destroySandbox = useDestroySandbox();
  const { files, isLoading: filesLoading, refresh: refreshFiles } = useSandboxFiles({
    sandboxId: sandbox.id,
  });
  const { run: runCode, isRunning: codeRunning } = useRunCode();

  // Auto-refresh files on mount and when sandbox becomes running
  useEffect(() => {
    if (sandbox.status === 'running') {
      refreshFiles();
    }
  }, [sandbox.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleRunCommand = useCallback(
    (command: string) => {
      runCommand.mutate({ sandboxId: sandbox.id, command });
    },
    [sandbox.id, runCommand],
  );

  const handleRunCode = useCallback(
    (code: string, language: Language) => {
      runCode({ sandboxId: sandbox.id, code, language });
      setActiveTab('terminal');
    },
    [sandbox.id, runCode],
  );

  const handleFileSelect = useCallback((file: SandboxFile) => {
    if (file.type === 'file') {
      setSelectedFile(file.path);
    }
  }, []);

  const handleStop = useCallback(() => {
    stopSandbox.mutate(sandbox.id);
  }, [sandbox.id, stopSandbox]);

  const handleDestroy = useCallback(() => {
    destroySandbox.mutate(sandbox.id);
  }, [sandbox.id, destroySandbox]);

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'editor', label: 'Code', icon: Code2 },
    { id: 'terminal', label: 'Terminal', icon: TerminalIcon },
    { id: 'files', label: 'Files', icon: Files },
  ];

  return (
    <div className={cn('flex h-full flex-col', className)} data-testid="sandbox-ide">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/sandboxes">
            <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="ide-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="truncate text-sm font-semibold">{sandbox.name}</h2>
          <span className="shrink-0 rounded bg-muted px-2 py-0.5 font-mono text-xs">
            {sandbox.image}
          </span>
        </div>
        <SandboxControls
          status={sandbox.status}
          onRun={() => setActiveTab('terminal')}
          onStop={handleStop}
          onDestroy={handleDestroy}
          isStopping={stopSandbox.isPending}
          isDestroying={destroySandbox.isPending}
        />
      </div>

      {/* Stream status banners */}
      {streamStatus === 'reconnecting' && (
        <div className="flex items-center gap-2 border-b border-yellow-500/30 bg-yellow-950/30 px-4 py-1.5 text-xs text-yellow-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
          Reconnecting to sandbox stream… (attempt {reconnectAttempt}/10)
        </div>
      )}
      {streamStatus === 'failed' && (
        <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-950/40 px-4 py-1.5 text-xs text-red-400">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          <span>Unable to reach the sandbox</span>
          <button
            onClick={retry}
            className="ml-auto rounded border border-red-500/40 bg-red-950/60 px-2 py-0.5 text-xs text-red-300 hover:bg-red-900/60"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b bg-muted/20">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border-b-2',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
            data-testid={`ide-tab-${tab.id}`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {activeTab === 'editor' && (
          <div className="flex flex-1 min-h-0">
            {/* File sidebar in editor mode */}
            <div className="w-56 shrink-0 border-r">
              <FileExplorer
                files={files}
                selectedPath={selectedFile}
                onSelect={handleFileSelect}
                onRefresh={refreshFiles}
                isLoading={filesLoading}
                className="h-full"
              />
            </div>

            {/* Code editor */}
            <div className="flex flex-1 flex-col min-w-0">
              <CodeEditor
                runtime={sandbox.runtime}
                onRun={handleRunCode}
                isRunning={codeRunning}
                readOnly={sandbox.status !== 'running'}
                className="flex-1 border-0 rounded-none"
              />
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="flex flex-1 flex-col min-h-0">
            <TerminalOutput
              lines={lines}
              isStreaming={isStreaming}
              onClear={clear}
              className="flex-1 min-h-0"
            />
            <div className="border-t p-2">
              <CommandInput
                onSubmit={handleRunCommand}
                disabled={sandbox.status !== 'running' || runCommand.isPending}
                placeholder={
                  sandbox.status !== 'running' ? 'Sandbox is not running' : '$ enter command…'
                }
              />
            </div>
          </div>
        )}

        {activeTab === 'files' && (
          <FileExplorer
            files={files}
            selectedPath={selectedFile}
            onSelect={handleFileSelect}
            onRefresh={refreshFiles}
            isLoading={filesLoading}
            className="flex-1"
          />
        )}
      </div>

      {/* Status bar */}
      <SandboxStatusBar sandbox={sandbox} />
    </div>
  );
}
