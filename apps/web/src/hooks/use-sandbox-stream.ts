// @ts-nocheck
'use client';

import type { SandboxInfo as SandboxOutputLine } from '@matanelcohen/openspace-shared';
import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_LINES = 5_000;

const INITIAL_RECONNECT_DELAY = 1_000;
const MAX_RECONNECT_DELAY = 30_000;
const RECONNECT_FACTOR = 2;
const MAX_RECONNECT_ATTEMPTS = 10;

export type StreamStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';

export interface StreamError {
  code: string;
  message: string;
}

function buildStreamUrl(sandboxId: string): string {
  const base =
    process.env.NEXT_PUBLIC_API_URL ??
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://localhost:3000');
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/ws/sandboxes/${sandboxId}/stream`;
}

/**
 * WebSocket hook that streams terminal output from a sandbox container.
 * Connects to a dedicated per-sandbox streaming endpoint and accumulates
 * output lines with automatic truncation to prevent memory leaks.
 * Includes exponential backoff reconnection (1s → 2s → 4s … 30s cap, max 10 attempts).
 */
export function useSandboxStream(sandboxId: string | null) {
  const [lines, setLines] = useState<SandboxOutputLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState<StreamStatus>('idle');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [lastError, setLastError] = useState<StreamError | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectAttemptRef = useRef(0);
  const connectRef = useRef<() => void>(null);

  const clear = useCallback(() => setLines([]), []);

  const retry = useCallback(() => {
    reconnectAttemptRef.current = 0;
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    setReconnectAttempt(0);
    connectRef.current?.();
  }, []);

  const connect = useCallback(
    (sid: string) => {
      if (!mountedRef.current) return;

      // Clean up previous connection
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        if (
          wsRef.current.readyState === WebSocket.OPEN ||
          wsRef.current.readyState === WebSocket.CONNECTING
        ) {
          wsRef.current.close();
        }
      }

      setStatus('connecting');

      const url = buildStreamUrl(sid);
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setIsStreaming(true);
        setStatus('connected');
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
      };

      ws.onmessage = (event: MessageEvent) => {
        if (!mountedRef.current) return;

        try {
          const data = JSON.parse(event.data as string);

          if (data.type === 'sandbox:output') {
            const line = data.payload as SandboxOutputLine;
            setLines((prev) => {
              const next = [...prev, line];
              return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
            });
          } else if (data.type === 'sandbox:output:batch') {
            const batch = data.payload as SandboxOutputLine[];
            setLines((prev) => {
              const next = [...prev, ...batch];
              return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
            });
          } else if (data.type === 'error') {
            setLastError({
              code: data.code as string,
              message: data.message as string,
            });
          }
        } catch {
          // Non-JSON messages (ping/welcome) are ignored
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setIsStreaming(false);

        const attempt = reconnectAttemptRef.current + 1;
        reconnectAttemptRef.current = attempt;
        setReconnectAttempt(attempt);

        if (attempt > MAX_RECONNECT_ATTEMPTS) {
          setStatus('failed');
        } else {
          setStatus('reconnecting');
          const delay = reconnectDelayRef.current;
          reconnectDelayRef.current = Math.min(delay * RECONNECT_FACTOR, MAX_RECONNECT_DELAY);
          reconnectTimerRef.current = setTimeout(() => {
            reconnectTimerRef.current = null;
            connectRef.current?.();
          }, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    },
    [], // stable — sandboxId is passed as argument
  );

  // Keep connectRef in sync so reconnect timers always call the latest connect
  useEffect(() => {
    if (sandboxId) {
      connectRef.current = () => connect(sandboxId);
    }
  }, [sandboxId, connect]);

  useEffect(() => {
    mountedRef.current = true;

    if (!sandboxId) {
      setIsStreaming(false);
      setStatus('idle');
      return;
    }

    // Reset state on new sandbox
    reconnectAttemptRef.current = 0;
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    setReconnectAttempt(0);

    connectRef.current = () => connect(sandboxId);
    connect(sandboxId);

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [sandboxId, connect]);

  return { lines, isStreaming, status, reconnectAttempt, lastError, clear, retry };
}
