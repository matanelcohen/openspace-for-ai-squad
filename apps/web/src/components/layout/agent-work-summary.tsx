'use client';

import { Activity } from 'lucide-react';

import { useAgentStatusSummary } from '@/hooks/use-agent-status';

export function AgentWorkSummary() {
  const { workingCount, totalQueued } = useAgentStatusSummary();

  if (workingCount === 0 && totalQueued === 0) return null;

  return (
    <div className="border-t px-4 py-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Activity className="h-3.5 w-3.5" />
        <span>
          {workingCount > 0 && (
            <span className="text-green-600 dark:text-green-400 font-medium">
              {workingCount} working
            </span>
          )}
          {workingCount > 0 && totalQueued > 0 && ', '}
          {totalQueued > 0 && (
            <span>{totalQueued} queued</span>
          )}
        </span>
      </div>
    </div>
  );
}
