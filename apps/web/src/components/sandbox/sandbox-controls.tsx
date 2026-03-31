// @ts-nocheck
'use client';

import type { SandboxStatus } from '@matanelcohen/openspace-shared';
import { Play, Square, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SandboxControlsProps {
  status: SandboxStatus;
  onRun: () => void;
  onStop: () => void;
  onDestroy: () => void;
  isRunning?: boolean;
  isStopping?: boolean;
  isDestroying?: boolean;
  className?: string;
}

export function SandboxControls({
  status,
  onRun,
  onStop,
  onDestroy,
  isRunning,
  isStopping,
  isDestroying,
  className,
}: SandboxControlsProps) {
  const canRun = status === 'running';
  const canStop = status === 'running';
  const canDestroy = status !== 'destroying' && status !== 'creating';

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex items-center gap-1', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onRun}
              disabled={!canRun || isRunning}
              data-testid="sandbox-run"
            >
              <Play className="h-4 w-4 text-green-600 dark:text-green-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Run command</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onStop}
              disabled={!canStop || isStopping}
              data-testid="sandbox-stop"
            >
              <Square className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Stop execution</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onDestroy}
              disabled={!canDestroy || isDestroying}
              data-testid="sandbox-destroy"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Destroy sandbox</TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
