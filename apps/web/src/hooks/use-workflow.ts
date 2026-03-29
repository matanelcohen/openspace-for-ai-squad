'use client';

import type { WorkflowDefinition, WorkflowExecutionState } from '@openspace/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';

import { useWebSocket, type WsEnvelope } from '@/hooks/use-websocket';
import { api } from '@/lib/api-client';

// ── Types ────────────────────────────────────────────────────────

interface UseWorkflowOptions {
  workflowId?: string;
  executionId?: string;
  /** Enable real-time status updates via WebSocket. Defaults to true. */
  realtime?: boolean;
}

interface UseWorkflowReturn {
  definition: WorkflowDefinition | undefined;
  executionState: WorkflowExecutionState | undefined;
  isLoading: boolean;
  error: Error | null;
  isConnected: boolean;
}

// ── Hook ─────────────────────────────────────────────────────────

/**
 * Hook for fetching a workflow definition and its execution state,
 * with real-time updates via WebSocket.
 */
export function useWorkflow({
  workflowId,
  executionId,
  realtime = true,
}: UseWorkflowOptions = {}): UseWorkflowReturn {
  const queryClient = useQueryClient();
  const { isConnected, subscribe, onEventRef } = useWebSocket();
  const subscribedRef = useRef(false);

  // Fetch workflow definition
  const {
    data: definition,
    isLoading: defLoading,
    error: defError,
  } = useQuery<WorkflowDefinition>({
    queryKey: ['workflow', workflowId],
    queryFn: () => api.get<WorkflowDefinition>(`/api/workflows/${workflowId}`),
    enabled: !!workflowId,
    refetchInterval: 300_000,
  });

  // Fetch execution state
  const {
    data: executionState,
    isLoading: execLoading,
    error: execError,
  } = useQuery<WorkflowExecutionState>({
    queryKey: ['workflow-execution', executionId],
    queryFn: () =>
      api.get<WorkflowExecutionState>(`/api/workflows/executions/${executionId}`),
    enabled: !!executionId,
    refetchInterval: 10_000,
  });

  // Subscribe to real-time workflow events
  useEffect(() => {
    if (realtime && isConnected && !subscribedRef.current) {
      subscribe(['task:updated'] as never[]);
      subscribedRef.current = true;
    }
  }, [realtime, isConnected, subscribe]);

  // Handle incoming WebSocket events
  const handleEvent = useCallback(
    (envelope: WsEnvelope) => {
      if (!executionId) return;

      const payload = envelope.payload as Record<string, unknown>;
      if (
        envelope.type === 'workflow:node-updated' ||
        envelope.type === 'workflow:status-changed'
      ) {
        if (payload.executionId === executionId) {
          queryClient.invalidateQueries({
            queryKey: ['workflow-execution', executionId],
          });
        }
      }
    },
    [executionId, queryClient],
  );

  useEffect(() => {
    onEventRef.current = handleEvent;
  }, [handleEvent, onEventRef]);

  return {
    definition,
    executionState,
    isLoading: defLoading || execLoading,
    error: (defError as Error | null) ?? (execError as Error | null),
    isConnected,
  };
}
