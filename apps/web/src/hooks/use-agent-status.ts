'use client';

import { useQuery,useQueryClient } from '@tanstack/react-query';

import { useWsEvent } from '@/components/providers/websocket-provider';
import { api } from '@/lib/api-client';

export interface AgentWorkTask {
  id: string;
  title: string;
  status: string;
  startedAt: string;
}

export interface AgentWorkStatus {
  activeTask: AgentWorkTask | null;
  queueLength: number;
  queuedTasks: { id: string; title: string }[];
}

export interface AgentStatusResponse {
  agents: Record<string, AgentWorkStatus>;
}

export function useAgentStatus() {
  const queryClient = useQueryClient();

  const query = useQuery<AgentStatusResponse>({
    queryKey: ['agent-status'],
    queryFn: () => api.get<AgentStatusResponse>('/api/agents/status'),
    refetchInterval: 30_000,
  });

  // Invalidate on agent:working events
  useWsEvent('agent:working', () => {
    queryClient.invalidateQueries({ queryKey: ['agent-status'] });
  });

  // Invalidate on agent:idle events
  useWsEvent('agent:idle', () => {
    queryClient.invalidateQueries({ queryKey: ['agent-status'] });
  });

  return query;
}

/** Derive a quick summary from the status map. */
export function useAgentStatusSummary() {
  const { data } = useAgentStatus();

  if (!data) return { workingCount: 0, totalQueued: 0 };

  let workingCount = 0;
  let totalQueued = 0;

  for (const status of Object.values(data.agents)) {
    if (status.activeTask) workingCount++;
    totalQueued += status.queueLength;
  }

  return { workingCount, totalQueued };
}
