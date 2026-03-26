'use client';

import '@xterm/xterm/css/xterm.css';

import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerm } from '@xterm/xterm';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

const API_HOST =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, '') ??
      `${window.location.hostname}:3001`)
    : 'localhost:3001';

const WS_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_WS_URL ??
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${API_HOST}`)
    : 'ws://localhost:3001';

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY_MS);
  const mountedRef = useRef(true);

  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  const sendResize = useCallback((cols: number, rows: number) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'resize', cols, rows }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    const term = termRef.current;
    if (!term) return;

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

    const ws = new WebSocket(`${WS_BASE}/api/terminal/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus('connected');
      reconnectDelayRef.current = RECONNECT_DELAY_MS;

      // Send initial size
      const fitAddon = fitAddonRef.current;
      if (fitAddon) {
        try {
          fitAddon.fit();
        } catch {
          // ignore fit errors during connection
        }
      }
      sendResize(term.cols, term.rows);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; data: string };
        if (msg.type === 'output') {
          term.write(msg.data);
        } else if (msg.type === 'error') {
          term.write(`\r\n\x1b[31m${msg.data}\x1b[0m`);
        }
      } catch {
        // Fallback: write raw data if not JSON
        if (typeof event.data === 'string') {
          term.write(event.data);
        }
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setStatus('disconnected');
      scheduleReconnect();
    };

    ws.onerror = () => {
      // Explicitly close so onclose always fires and triggers reconnect
      ws.close();
    };
  }, [sendResize]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

    const delay = reconnectDelayRef.current;
    reconnectTimerRef.current = setTimeout(() => {
      reconnectTimerRef.current = null;
      connect();
    }, delay);

    // Exponential backoff
    reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
  }, [connect]);

  useEffect(() => {
    mountedRef.current = true;
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
      fontSize: 14,
      lineHeight: 1.2,
      theme: {
        background: '#0a0a0f',
        foreground: '#e4e4e7',
        cursor: '#e4e4e7',
        cursorAccent: '#0a0a0f',
        selectionBackground: '#3f3f46',
        selectionForeground: '#e4e4e7',
        black: '#27272a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#e4e4e7',
        brightBlack: '#52525b',
        brightRed: '#f87171',
        brightGreen: '#4ade80',
        brightYellow: '#facc15',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fafafa',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    term.open(container);

    // Initial fit
    try {
      fitAddon.fit();
    } catch {
      // container may not be sized yet
    }

    // Pipe terminal input → WebSocket
    term.onData((data) => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'input', data }));
      }
    });

    // Handle terminal resize → WebSocket
    term.onResize(({ cols, rows }) => {
      sendResize(cols, rows);
    });

    // Window resize handler
    const handleResize = () => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    };
    window.addEventListener('resize', handleResize);

    // ResizeObserver for container size changes (e.g., sidebar toggle)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // Connect
    connect();

    return () => {
      mountedRef.current = false;
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }

      if (wsRef.current) {
        wsRef.current.onopen = null;
        wsRef.current.onclose = null;
        wsRef.current.onmessage = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }

      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [connect, sendResize]);

  return (
    <div className="relative flex h-full flex-col">
      {/* Status indicator */}
      <div className="flex items-center gap-2 border-b border-border bg-background/80 px-4 py-2 backdrop-blur-sm">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            status === 'connected' && 'bg-green-500',
            status === 'connecting' && 'animate-pulse bg-yellow-500',
            status === 'disconnected' && 'bg-red-500',
          )}
        />
        <span className="text-xs text-muted-foreground">
          {status === 'connected' && 'Connected'}
          {status === 'connecting' && 'Connecting…'}
          {status === 'disconnected' && 'Disconnected — reconnecting…'}
        </span>
      </div>

      {/* Terminal container */}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 bg-[#0a0a0f] p-1"
        style={{ overflow: 'hidden' }}
      />
    </div>
  );
}
