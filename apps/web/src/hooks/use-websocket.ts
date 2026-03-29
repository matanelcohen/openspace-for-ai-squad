'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type WsEventType =
  | 'agent:status'
  | 'agent:working'
  | 'agent:idle'
  | 'task:updated'
  | 'task:created'
  | 'decision:added'
  | 'activity:new'
  | 'chat:message'
  | 'chat:typing'
  | 'chat:cleared'
  | 'channel:created'
  | 'channel:updated'
  | 'channel:deleted'
  | 'voice:session'
  | 'voice:transcript'
  | 'voice:audio'
  | 'voice:speaking'
  | 'escalation:created'
  | 'escalation:updated';

export interface WsEnvelope {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

function buildWsUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_API_URL ??
    (typeof window !== 'undefined'
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://localhost:3000');
  const wsBase = base.replace(/^http/, 'ws');
  return `${wsBase}/ws`;
}

const INITIAL_RECONNECT_DELAY = 1_000;
const MAX_RECONNECT_DELAY = 30_000;
const RECONNECT_FACTOR = 2;

export function useWebSocket(url?: string) {
  const wsUrl = url ?? buildWsUrl();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onEventRef = useRef<((envelope: WsEnvelope) => void) | null>(null);

  const [lastEvent, setLastEvent] = useState<WsEnvelope | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const subscribe = useCallback(
    (events: WsEventType[]) => {
      send({ action: 'subscribe', events });
    },
    [send],
  );

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setIsConnected(true);
      reconnectDelay.current = INITIAL_RECONNECT_DELAY;
    };

    ws.onmessage = (event: MessageEvent) => {
      if (!mountedRef.current) return;

      const raw = typeof event.data === 'string' ? event.data : '';

      if (raw === 'ping') {
        send({ action: 'pong' });
        return;
      }

      try {
        const parsed = JSON.parse(raw) as WsEnvelope;
        setLastEvent(parsed);
        // Dispatch immediately via callback ref so rapid events aren't lost to React batching
        onEventRef.current?.(parsed);
      } catch {
        // ignore non-JSON messages (e.g. welcome)
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setIsConnected(false);

      const delay = reconnectDelay.current;
      reconnectDelay.current = Math.min(delay * RECONNECT_FACTOR, MAX_RECONNECT_DELAY);
      reconnectTimer.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, [wsUrl, send]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      wsRef.current?.close();
    };
  }, [connect]);

  return { lastEvent, isConnected, send, subscribe, onEventRef };
}
