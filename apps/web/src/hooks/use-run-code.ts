// @ts-nocheck
'use client';

import { useCallback, useState } from 'react';

import { useRunCommand } from './use-sandboxes';

import type { SandboxRuntime } from '@matanelcohen/openspace-shared';

type Language = 'javascript' | 'typescript' | 'python' | 'go' | 'bash' | 'json';

interface RunCodeOptions {
  sandboxId: string;
  code: string;
  language: Language;
}

interface RunCodeResult {
  success: boolean;
  output: string;
  exitCode?: number;
  durationMs?: number;
}

/**
 * Build the shell command to execute code for a given language.
 */
export function buildRunCommand(code: string, language: Language): string {
  switch (language) {
    case 'javascript':
      return `node -e ${JSON.stringify(code)}`;
    case 'typescript':
      return `cat > /tmp/_run.ts << 'SANDBOX_EOF'\n${code}\nSANDBOX_EOF\nnpx ts-node /tmp/_run.ts 2>&1 || node -e ${JSON.stringify(code)}`;
    case 'python':
      return `python3 -c ${JSON.stringify(code)}`;
    case 'go':
      return `mkdir -p /tmp/gorun && cat > /tmp/gorun/main.go << 'SANDBOX_EOF'\n${code}\nSANDBOX_EOF\ncd /tmp/gorun && go run main.go`;
    case 'bash':
      return code;
    case 'json':
      return `echo ${JSON.stringify(code)} | python3 -m json.tool 2>/dev/null || echo ${JSON.stringify(code)} | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(d),null,2)))"`;
    default:
      return code;
  }
}

const RUNTIME_LANGUAGES: Record<SandboxRuntime, Language[]> = {
  node: ['javascript', 'typescript', 'bash', 'json'],
  python: ['python', 'bash', 'json'],
  go: ['go', 'bash', 'json'],
};

export { type Language, type RunCodeResult, RUNTIME_LANGUAGES };

export function useRunCode() {
  const runCommand = useRunCommand();
  const [lastResult, setLastResult] = useState<RunCodeResult | null>(null);

  const run = useCallback(
    ({ sandboxId, code, language }: RunCodeOptions) => {
      const command = buildRunCommand(code, language);

      runCommand.mutate(
        { sandboxId, command },
        {
          onSuccess: (result: unknown) => {
            const res = result as {
              stdout?: string;
              stderr?: string;
              exitCode?: number;
              durationMs?: number;
            };
            setLastResult({
              success: (res.exitCode ?? 0) === 0,
              output: [res.stdout, res.stderr].filter(Boolean).join('\n'),
              exitCode: res.exitCode,
              durationMs: res.durationMs,
            });
          },
          onError: (error) => {
            setLastResult({
              success: false,
              output: error.message,
            });
          },
        },
      );
    },
    [runCommand],
  );

  return {
    run,
    lastResult,
    isRunning: runCommand.isPending,
    clearResult: () => setLastResult(null),
  };
}
