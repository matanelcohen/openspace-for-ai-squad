// @ts-nocheck
'use client';

import type { SandboxRuntime, SandboxTemplate } from '@matanelcohen/openspace-shared';
import { Code2, FileCode, Server } from 'lucide-react';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const SANDBOX_TEMPLATES: SandboxTemplate[] = [
  {
    id: 'node-blank',
    name: 'Node.js',
    description: 'Blank Node.js 22 environment with npm',
    runtime: 'node',
    icon: '⬢',
  },
  {
    id: 'node-typescript',
    name: 'TypeScript',
    description: 'Node.js with TypeScript, ts-node, and tsconfig',
    runtime: 'node',
    icon: '🔷',
    setupCommand: 'npm init -y && npm i -D typescript ts-node @types/node && npx tsc --init',
  },
  {
    id: 'node-express',
    name: 'Express API',
    description: 'Express.js REST API starter with TypeScript',
    runtime: 'node',
    icon: '🚀',
    setupCommand:
      'npm init -y && npm i express && npm i -D typescript ts-node @types/node @types/express && npx tsc --init',
  },
  {
    id: 'python-blank',
    name: 'Python',
    description: 'Python 3.12 with pip package manager',
    runtime: 'python',
    icon: '🐍',
  },
  {
    id: 'python-fastapi',
    name: 'FastAPI',
    description: 'FastAPI web framework with uvicorn',
    runtime: 'python',
    icon: '⚡',
    setupCommand: 'pip install fastapi uvicorn',
  },
  {
    id: 'python-data',
    name: 'Data Science',
    description: 'Python with numpy, pandas, and matplotlib',
    runtime: 'python',
    icon: '📊',
    setupCommand: 'pip install numpy pandas matplotlib',
  },
  {
    id: 'go-blank',
    name: 'Go',
    description: 'Go 1.22 with module support',
    runtime: 'go',
    icon: '🔷',
  },
  {
    id: 'go-web',
    name: 'Go Web Server',
    description: 'Go HTTP server with chi router',
    runtime: 'go',
    icon: '🌐',
    setupCommand: 'go mod init sandbox && go get github.com/go-chi/chi/v5',
  },
];

const RUNTIME_ICONS: Record<SandboxRuntime, React.ComponentType<{ className?: string }>> = {
  node: Code2,
  python: FileCode,
  go: Server,
};

interface SandboxTemplatesProps {
  onSelect: (template: SandboxTemplate) => void;
  className?: string;
}

export function SandboxTemplates({ onSelect, className }: SandboxTemplatesProps) {
  const grouped = SANDBOX_TEMPLATES.reduce(
    (acc, tpl) => {
      (acc[tpl.runtime] ??= []).push(tpl);
      return acc;
    },
    {} as Record<SandboxRuntime, SandboxTemplate[]>,
  );

  const runtimeOrder: SandboxRuntime[] = ['node', 'python', 'go'];
  const runtimeLabels: Record<SandboxRuntime, string> = {
    node: 'Node.js',
    python: 'Python',
    go: 'Go',
  };

  return (
    <div className={cn('space-y-4', className)} data-testid="sandbox-templates">
      {runtimeOrder.map((runtime) => {
        const templates = grouped[runtime];
        if (!templates?.length) return null;
        const Icon = RUNTIME_ICONS[runtime];

        return (
          <div key={runtime}>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <Icon className="h-3.5 w-3.5" />
              {runtimeLabels[runtime]}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {templates.map((tpl) => (
                <Card
                  key={tpl.id}
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
                  onClick={() => onSelect(tpl)}
                  data-testid={`template-${tpl.id}`}
                >
                  <CardHeader className="p-3 pb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tpl.icon}</span>
                      <span className="text-sm font-medium">{tpl.name}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-3 pt-0">
                    <p className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
