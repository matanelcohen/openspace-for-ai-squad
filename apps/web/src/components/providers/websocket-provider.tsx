'use client';

import { createContext, useCallback, useContext, useEffect, useRef } from 'react';

import type { WsEnvelope, WsErrorEnvelope, WsEventType } from '@/hooks/use-websocket';
import { useWebSocket } from '@/hooks/use-websocket';

type WsEventCallback = (envelope: WsEnvelope) => void;
type WsErrorCallback = (error: WsErrorEnvelope) => void;

interface WsContextValue {
  lastEvent: WsEnvelope | null;
  lastError: WsErrorEnvelope | null;
  isConnected: boolean;
  send: (msg: Record<string, unknown>) => void;
  subscribe: (events: WsEventType[]) => void;
  addListener: (type: string, cb: WsEventCallback) => () => void;
  addErrorListener: (cb: WsErrorCallback) => () => void;
}

const WsContext = createContext<WsContextValue | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const { lastEvent, lastError, isConnected, send, subscribe, onEventRef, onErrorRef } =
    useWebSocket();
  const listenersRef = useRef<Map<string, Set<WsEventCallback>>>(new Map());
  const errorListenersRef = useRef<Set<WsErrorCallback>>(new Set());

  const addListener = useCallback((type: string, cb: WsEventCallback): (() => void) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(cb);

    return () => {
      listenersRef.current.get(type)?.delete(cb);
    };
  }, []);

  const addErrorListener = useCallback((cb: WsErrorCallback): (() => void) => {
    errorListenersRef.current.add(cb);
    return () => {
      errorListenersRef.current.delete(cb);
    };
  }, []);

  // Dispatch events directly from the WebSocket onmessage handler
  // to avoid React state batching dropping rapid events
  useEffect(() => {
    onEventRef.current = (envelope: WsEnvelope) => {
      const callbacks = listenersRef.current.get(envelope.type);
      if (callbacks) {
        callbacks.forEach((cb) => cb(envelope));
      }
    };
    onErrorRef.current = (error: WsErrorEnvelope) => {
      errorListenersRef.current.forEach((cb) => cb(error));
    };
    return () => {
      onEventRef.current = null;
      onErrorRef.current = null;
    };
  }, [onEventRef, onErrorRef]);

  return (
    <WsContext.Provider
      value={{ lastEvent, lastError, isConnected, send, subscribe, addListener, addErrorListener }}
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

/**
 * Subscribe to WebSocket error envelopes (e.g. server-side parse failures).
 * The callback fires immediately from the WebSocket onmessage handler.
 */
export function useWsError(callback: WsErrorCallback) {
  const ctx = useContext(WsContext);
  if (!ctx) {
    throw new Error('useWsError must be used within a WebSocketProvider');
  }

  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    const handler: WsErrorCallback = (error) => cbRef.current(error);
    return ctx.addErrorListener(handler);
  }, [ctx]);
}

/**
 * Get the last error envelope received from the server.
 */
export function useWsLastError() {
  const ctx = useContext(WsContext);
  if (!ctx) {
    throw new Error('useWsLastError must be used within a WebSocketProvider');
  }
  return ctx.lastError;
}
