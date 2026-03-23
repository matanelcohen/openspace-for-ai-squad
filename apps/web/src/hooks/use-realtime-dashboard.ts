'use client';

import type { Agent, SquadOverview, Task } from '@openspace/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { WsEnvelope } from '@/hooks/use-websocket';

/**
 * Listens to WebSocket events and patches TanStack Query caches
 * so dashboard data updates instantly without polling.
 *
 * Returns `pulsing` — a transient flag that goes true for ~600ms
 * after every cache update, letting cards play a pulse animation.
 */
export function useRealtimeDashboard(
  addWsListener?: (type: string, cb: (e: WsEnvelope) => void) => () => void,
) {
  const queryClient = useQueryClient();
  const [pulsing, setPulsing] = useState(false);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerPulse = useCallback(() => {
    setPulsing(true);
    if (pulseTimer.current) clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulsing(false), 600);
  }, []);

  useEffect(() => {
    if (!addWsListener) return;

    const removers: (() => void)[] = [];

    // agent:status — update agent status in cache
    removers.push(
      addWsListener('agent:status', (envelope: WsEnvelope) => {
        const { agentId, status } = envelope.payload as {
          agentId?: string;
          status?: string;
        };
        if (!agentId) return;

        queryClient.setQueryData<Agent[]>(['agents'], (old) =>
          old?.map((a) =>
            a.id === agentId ? { ...a, status: status as Agent['status'] } : a,
          ),
        );

        queryClient.setQueryData<SquadOverview>(['squad'], (old) => {
          if (!old) return old;
          return {
            ...old,
            agents: old.agents?.map((a: Agent) =>
              a.id === agentId ? { ...a, status: status as Agent['status'] } : a,
            ),
          };
        });

        triggerPulse();
      }),
    );

    // task:updated — patch task in cache
    removers.push(
      addWsListener('task:updated', (envelope: WsEnvelope) => {
        const payload = envelope.payload as Partial<Task> & { id?: string; taskId?: string };
        const taskId = payload.id ?? payload.taskId;
        if (!taskId) return;

        queryClient.setQueryData<Task[]>(['tasks'], (old) =>
          old?.map((t) => (t.id === taskId ? { ...t, ...payload } : t)),
        );

        // Invalidate squad so summary stats refresh
        queryClient.invalidateQueries({ queryKey: ['squad'] });
        triggerPulse();
      }),
    );

    // task:created — add new task to cache
    removers.push(
      addWsListener('task:created', (envelope: WsEnvelope) => {
        const task = envelope.payload as Task;
        if (!task.id) return;

        queryClient.setQueryData<Task[]>(['tasks'], (old) => {
          if (!old) return [task];
          if (old.some((t) => t.id === task.id)) return old;
          return [...old, task];
        });

        queryClient.invalidateQueries({ queryKey: ['squad'] });
        triggerPulse();
      }),
    );

    // decision:added — invalidate squad to refresh decision counts
    removers.push(
      addWsListener('decision:added', () => {
        queryClient.invalidateQueries({ queryKey: ['squad'] });
        triggerPulse();
      }),
    );

    return () => {
      removers.forEach((rm) => rm());
      if (pulseTimer.current) clearTimeout(pulseTimer.current);
    };
  }, [addWsListener, queryClient, triggerPulse]);

  return { pulsing };
}
