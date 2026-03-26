'use client';

import type { SandboxOutputLine } from '@openspace/shared';
import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_LINES = 5_000;

function buildStreamUrl(sandboxId: string): string {
  const base =
    process.env.NEXT_PUBLIC_API_URL ??
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.hostname}:3001`
      : 'http://localhost:3001');
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/ws/sandboxes/${sandboxId}/stream`;
}

/**
 * WebSocket hook that streams terminal output from a sandbox container.
 * Connects to a dedicated per-sandbox streaming endpoint and accumulates
 * output lines with automatic truncation to prevent memory leaks.
 */
export function useSandboxStream(sandboxId: string | null) {
  const [lines, setLines] = useState<SandboxOutputLine[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const mountedRef = useRef(true);

  const clear = useCallback(() => setLines([]), []);

  useEffect(() => {
    mountedRef.current = true;

    if (!sandboxId) {
      setIsStreaming(false);
      return;
    }

    const url = buildStreamUrl(sandboxId);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (mountedRef.current) setIsStreaming(true);
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
        }
      } catch {
        // Non-JSON messages (ping/welcome) are ignored
      }
    };

    ws.onclose = () => {
      if (mountedRef.current) setIsStreaming(false);
    };

    ws.onerror = () => {
      ws.close();
    };

    return () => {
      mountedRef.current = false;
      ws.close();
      wsRef.current = null;
    };
  }, [sandboxId]);

  return { lines, isStreaming, clear };
}
