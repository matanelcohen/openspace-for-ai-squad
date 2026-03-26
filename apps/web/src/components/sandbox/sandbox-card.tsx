'use client';

import type { Sandbox } from '@openspace/shared';
import { Box, Clock, Cpu } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SandboxCardProps {
  sandbox: Sandbox;
  isSelected?: boolean;
  onSelect?: (sandbox: Sandbox) => void;
}

const STATUS_STYLES: Record<
  Sandbox['status'],
  { dot: string; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  creating: { dot: 'bg-blue-500 animate-pulse', label: 'Creating', variant: 'secondary' },
  running: { dot: 'bg-green-500', label: 'Running', variant: 'default' },
  stopped: { dot: 'bg-gray-400', label: 'Stopped', variant: 'outline' },
  error: { dot: 'bg-red-500', label: 'Error', variant: 'destructive' },
  destroying: { dot: 'bg-amber-500 animate-pulse', label: 'Destroying', variant: 'secondary' },
};

const RUNTIME_LABELS: Record<Sandbox['runtime'], { label: string; icon: string }> = {
  node: { label: 'Node.js', icon: '⬢' },
  python: { label: 'Python', icon: '🐍' },
  go: { label: 'Go', icon: '🔷' },
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function SandboxCard({ sandbox, isSelected, onSelect }: SandboxCardProps) {
  const statusStyle = STATUS_STYLES[sandbox.status];
  const runtimeInfo = RUNTIME_LABELS[sandbox.runtime];
  const memPercent =
    sandbox.resources.memoryLimitMb > 0
      ? Math.round((sandbox.resources.memoryMb / sandbox.resources.memoryLimitMb) * 100)
      : 0;

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary shadow-md',
      )}
      onClick={() => onSelect?.(sandbox)}
      data-testid={`sandbox-card-${sandbox.id}`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', statusStyle.dot)} />
          <span className="truncate text-sm font-medium">{sandbox.name}</span>
        </div>
        <Badge variant={statusStyle.variant} className="text-[10px] px-1.5 py-0 shrink-0">
          {statusStyle.label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1.5 p-3 pt-0">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Box className="h-3 w-3" />
            <span>
              {runtimeInfo.icon} {runtimeInfo.label}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatRelativeTime(sandbox.lastActivityAt)}</span>
          </span>
        </div>

        {sandbox.status === 'running' && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Cpu className="h-3 w-3" />
              <span>{sandbox.resources.cpuPercent.toFixed(0)}% CPU</span>
            </span>
            <span>
              {sandbox.resources.memoryMb.toFixed(0)}/{sandbox.resources.memoryLimitMb}MB (
              {memPercent}%)
            </span>
          </div>
        )}

        {sandbox.agentId && (
          <div className="text-xs text-muted-foreground/70 truncate">Agent: {sandbox.agentId}</div>
        )}
      </CardContent>
    </Card>
  );
}
