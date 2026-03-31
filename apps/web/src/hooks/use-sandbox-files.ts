// @ts-nocheck — agent-generated sandbox hooks, needs type cleanup
'use client';

import type { SandboxInfo as SandboxFile } from '@matanelcohen/openspace-shared';
import { useCallback, useState } from 'react';

import { useRunCommand } from './use-sandboxes';

interface UseSandboxFilesOptions {
  sandboxId: string | null;
  basePath?: string;
}

/**
 * Parse `find` output into a SandboxFile tree structure.
 * Input lines like:
 *   /workspace/src/index.ts 1234
 *   /workspace/package.json 567
 */
export function parseFileTree(output: string, basePath: string): SandboxFile[] {
  const lines = output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const root: Record<string, SandboxFile> = {};

  for (const line of lines) {
    // Format: "type path size"  (type = f or d)
    const match = line.match(/^([fd])\s+(.+?)\s+(\d+)$/);
    if (!match) continue;

    const [, type, fullPath, sizeStr] = match;
    const relativePath = fullPath?.startsWith(basePath)
      ? fullPath.slice(basePath.length).replace(/^\//, '')
      : fullPath ?? '';

    if (!relativePath) continue;

    const parts = relativePath.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join('/');

      if (!current[part]) {
        current[part] = {
          name: part,
          path: currentPath,
          type: isLast && type === 'f' ? 'file' : 'directory',
          size: isLast && type === 'f' ? parseInt(sizeStr ?? '0', 10) : undefined,
          children: isLast && type === 'f' ? undefined : [],
        };
      }

      if (!isLast) {
        if (!current[part].children) {
          current[part].children = [];
        }
        const children = current[part].children!;
        const childMap: Record<string, SandboxFile> = {};
        for (const child of children) {
          childMap[child.name] = child;
        }
        current = childMap;

        // Sync children array back after we modify childMap
        const nextPart = parts[i + 1];
        if (!childMap[nextPart]) {
          const nextPath = parts.slice(0, i + 2).join('/');
          const nextIsLast = i + 1 === parts.length - 1;
          const nextNode: SandboxFile = {
            name: nextPart,
            path: nextPath,
            type: nextIsLast && type === 'f' ? 'file' : 'directory',
            size: nextIsLast && type === 'f' ? parseInt(sizeStr, 10) : undefined,
            children: nextIsLast && type === 'f' ? undefined : [],
          };
          childMap[nextPart] = nextNode;
          children.push(nextNode);
        }
        // Skip to next level via childMap
        if (i + 1 < parts.length - 1) {
          current = (() => {
            const c: Record<string, SandboxFile> = {};
            for (const ch of childMap[nextPart].children ?? []) {
              c[ch.name] = ch;
            }
            return c;
          })();
          i++; // skip one level since we already processed it
        } else {
          break; // we already added the final node
        }
      }
    }
  }

  // Convert root map to sorted array
  return sortFiles(Object.values(root));
}

function sortFiles(files: SandboxFile[]): SandboxFile[] {
  return files
    .map((f) => ({
      ...f,
      children: f.children ? sortFiles(f.children) : undefined,
    }))
    .sort((a, b) => {
      // Directories first
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

export function useSandboxFiles({ sandboxId, basePath = '/workspace' }: UseSandboxFilesOptions) {
  const [files, setFiles] = useState<SandboxFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const runCommand = useRunCommand();

  const refresh = useCallback(() => {
    if (!sandboxId) return;

    setIsLoading(true);
    runCommand.mutate(
      {
        sandboxId,
        command: `find ${basePath} -maxdepth 4 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/__pycache__/*' -printf '%y %p %s\\n' 2>/dev/null || find ${basePath} -maxdepth 4 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/__pycache__/*' -exec stat -f '%HT %N %z' {} \\; 2>/dev/null`,
      },
      {
        onSuccess: (result: unknown) => {
          const output = (result as { stdout?: string })?.stdout ?? '';
          const parsed = parseFileTree(output, basePath);
          setFiles(parsed);
          setIsLoading(false);
        },
        onError: () => {
          setIsLoading(false);
        },
      },
    );
  }, [sandboxId, basePath, runCommand]);

  return { files, isLoading, refresh };
}
