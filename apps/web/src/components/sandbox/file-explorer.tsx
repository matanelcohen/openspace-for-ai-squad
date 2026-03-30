'use client';

import type { SandboxFile } from '@matanelcohen/openspace-shared';
import { ChevronDown, ChevronRight, File, Folder, FolderOpen, RefreshCw } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface FileNodeProps {
  file: SandboxFile;
  depth: number;
  selectedPath: string | null;
  onSelect: (file: SandboxFile) => void;
}

function FileNode({ file, depth, selectedPath, onSelect }: FileNodeProps) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isDirectory = file.type === 'directory';
  const isSelected = selectedPath === file.path;

  const handleClick = useCallback(() => {
    if (isDirectory) {
      setExpanded((prev) => !prev);
    }
    onSelect(file);
  }, [file, isDirectory, onSelect]);

  const getFileIcon = () => {
    if (isDirectory) {
      return expanded ? (
        <FolderOpen className="h-3.5 w-3.5 text-blue-400" />
      ) : (
        <Folder className="h-3.5 w-3.5 text-blue-400" />
      );
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    const colorMap: Record<string, string> = {
      js: 'text-yellow-400',
      ts: 'text-blue-400',
      tsx: 'text-blue-400',
      jsx: 'text-yellow-400',
      py: 'text-green-400',
      go: 'text-cyan-400',
      json: 'text-amber-400',
      md: 'text-gray-400',
      sh: 'text-purple-400',
    };

    return <File className={cn('h-3.5 w-3.5', colorMap[ext ?? ''] ?? 'text-muted-foreground')} />;
  };

  return (
    <div data-testid={`file-node-${file.path}`}>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-xs transition-colors',
          'hover:bg-accent hover:text-accent-foreground',
          isSelected && 'bg-accent text-accent-foreground',
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {isDirectory ? (
          <span className="shrink-0">
            {expanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </span>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {getFileIcon()}
        <span className="truncate">{file.name}</span>

        {file.size != null && !isDirectory && (
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/50">
            {formatFileSize(file.size)}
          </span>
        )}
      </button>

      {isDirectory && expanded && file.children && (
        <div>
          {file.children.map((child) => (
            <FileNode
              key={child.path}
              file={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`;
}

interface FileExplorerProps {
  files: SandboxFile[];
  selectedPath: string | null;
  onSelect: (file: SandboxFile) => void;
  onRefresh?: () => void;
  isLoading?: boolean;
  className?: string;
}

export function FileExplorer({
  files,
  selectedPath,
  onSelect,
  onRefresh,
  isLoading,
  className,
}: FileExplorerProps) {
  return (
    <div className={cn('flex flex-col', className)} data-testid="file-explorer">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Files
        </span>
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onRefresh}
            disabled={isLoading}
            data-testid="file-refresh"
          >
            <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
          </Button>
        )}
      </div>

      {/* File tree */}
      <ScrollArea className="flex-1">
        <div className="p-1">
          {isLoading && files.length === 0 ? (
            <div className="space-y-1 p-2">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-5 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          ) : files.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No files found
            </div>
          ) : (
            files.map((file) => (
              <FileNode
                key={file.path}
                file={file}
                depth={0}
                selectedPath={selectedPath}
                onSelect={onSelect}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
