'use client';

import { useCallback, useRef, useState } from 'react';

import { useWsEvent } from '@/components/providers/websocket-provider';

export interface TaskEvent {
  type: string;
  message: string;
  timestamp: string;
}

export function useTaskEvents(taskId: string) {
  const [events, setEvents] = useState<TaskEvent[]>([]);
  const [isWorking, setIsWorking] = useState(false);
  const taskIdRef = useRef(taskId);
  taskIdRef.current = taskId;

  const handleEvent = useCallback(
    (envelope: { payload: Record<string, unknown>; timestamp: string }) => {
      const payload = envelope.payload;
      const eventTaskId = (payload.taskId as string) ?? (payload.id as string);
      if (eventTaskId !== taskIdRef.current) return;

      // Status-only updates (no progress message)
      const status = payload.status as string | undefined;
      if (status && !payload.progressMessage) {
        if (status === 'in-progress') {
          setIsWorking(true);
        } else if (status === 'done' || status === 'blocked' || status === 'delegated') {
          setIsWorking(false);
          const icon = status === 'done' ? '✅' : status === 'delegated' ? '🔀' : '🛑';
          const label = status === 'done' ? 'completed' : status === 'delegated' ? 'delegated to subtasks' : 'blocked';
          setEvents((prev) => [
            ...prev,
            {
              type: status,
              message: `${icon} Task ${label}`,
              timestamp: envelope.timestamp,
            },
          ]);
        }
        return;
      }

      // Progress event with message
      if (payload.progressMessage) {
        setIsWorking(true);
        setEvents((prev) => [
          ...prev,
          {
            type: (payload.progressEvent as string) ?? 'info',
            message: payload.progressMessage as string,
            timestamp: envelope.timestamp,
          },
        ]);
      }
    },
    [],
  );

  useWsEvent('task:updated', handleEvent);

  const clearEvents = useCallback(() => setEvents([]), []);

  return { events, isWorking, clearEvents };
}
