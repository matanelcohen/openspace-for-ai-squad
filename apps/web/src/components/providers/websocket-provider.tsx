'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from 'react';

import type { WsEnvelope, WsEventType } from '@/hooks/use-websocket';
import { useWebSocket } from '@/hooks/use-websocket';

type WsEventCallback = (envelope: WsEnvelope) => void;

interface WsContextValue {
  lastEvent: WsEnvelope | null;
  isConnected: boolean;
  send: (msg: Record<string, unknown>) => void;
  subscribe: (events: WsEventType[]) => void;
  addListener: (type: string, cb: WsEventCallback) => () => void;
}

const WsContext = createContext<WsContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { lastEvent, isConnected, send, subscribe } = useWebSocket();
  const listenersRef = useRef<Map<string, Set<WsEventCallback>>>(new Map());

  const addListener = useCallback(
    (type: string, cb: WsEventCallback): (() => void) => {
      if (!listenersRef.current.has(type)) {
        listenersRef.current.set(type, new Set());
      }
      listenersRef.current.get(type)!.add(cb);

      return () => {
        listenersRef.current.get(type)?.delete(cb);
      };
    },
    [],
  );

  useEffect(() => {
    if (!lastEvent) return;
    const callbacks = listenersRef.current.get(lastEvent.type);
    if (callbacks) {
      callbacks.forEach((cb) => cb(lastEvent));
    }
  }, [lastEvent]);

  return (
    <WsContext.Provider
      value={{ lastEvent, isConnected, send, subscribe, addListener }}
    >
      {children}
    </WsContext.Provider>
  );
}

export function useWsEvent(type: WsEventType, callback: WsEventCallback) {
  const ctx = useContext(WsContext);
  if (!ctx) {
    throw new Error('useWsEvent must be used within a WebSocketProvider');
  }

  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    const handler: WsEventCallback = (envelope) => cbRef.current(envelope);
    return ctx.addListener(type, handler);
  }, [ctx, type]);
}

export function useWsConnection() {
  const ctx = useContext(WsContext);
  if (!ctx) {
    throw new Error('useWsConnection must be used within a WebSocketProvider');
  }
  return { isConnected: ctx.isConnected };
}

export function wsSend(ctx: WsContextValue, msg: Record<string, unknown>) {
  ctx.send(msg);
}

export function useWsSend() {
  const ctx = useContext(WsContext);
  if (!ctx) {
    throw new Error('useWsSend must be used within a WebSocketProvider');
  }
  return ctx.send;
}
