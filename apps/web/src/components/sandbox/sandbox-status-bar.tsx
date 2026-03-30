'use client';

import type { Sandbox } from '@openspace/shared';
import { Activity, Clock, Cpu, HardDrive } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SandboxStatusBarProps {
  sandbox: Sandbox;
  className?: string;
}

const STATUS_COLORS: Record<Sandbox['status'], string> = {
  creating: 'bg-blue-500',
  running: 'bg-green-500',
  stopped: 'bg-gray-400',
  error: 'bg-red-500',
  destroying: 'bg-amber-500',
};

export function SandboxStatusBar({ sandbox, className }: SandboxStatusBarProps) {
  const memPercent =
    sandbox.resources.memoryLimitMb > 0
      ? Math.round((sandbox.resources.memoryMb / sandbox.resources.memoryLimitMb) * 100)
      : 0;

  return (
    <div
      className={cn(
        'flex items-center gap-4 border-t bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground',
        className,
      )}
      data-testid="sandbox-status-bar"
    >
      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className={cn('h-2 w-2 rounded-full', STATUS_COLORS[sandbox.status])} />
        <span className="capitalize">{sandbox.status}</span>
      </div>

      {/* Runtime */}
      <div className="flex items-center gap-1">
        <Activity className="h-3 w-3" />
        <span className="font-mono">{sandbox.image}</span>
      </div>

      {/* Resources (only when running) */}
      {sandbox.status === 'running' && (
        <>
          <div className="flex items-center gap-1">
            <Cpu className="h-3 w-3" />
            <span>{sandbox.resources.cpuPercent.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            <span>
              {sandbox.resources.memoryMb.toFixed(0)}/{sandbox.resources.memoryLimitMb}MB ({memPercent}%)
            </span>
          </div>
        </>
      )}

      {/* Uptime */}
      <div className="flex items-center gap-1 ml-auto">
        <Clock className="h-3 w-3" />
        <span>{formatUptime(sandbox.createdAt)}</span>
      </div>

      {/* Agent badge */}
      {sandbox.agentId && (
        <Badge variant="outline" className="h-5 text-[10px] px-1.5">
          {sandbox.agentId}
        </Badge>
      )}
    </div>
  );
}

function formatUptime(createdAt: string): string {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}
