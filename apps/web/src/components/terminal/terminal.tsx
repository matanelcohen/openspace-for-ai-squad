'use client';

import '@xterm/xterm/css/xterm.css';

import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTerm } from '@xterm/xterm';
import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

const API_HOST =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL?.replace(/^https?:\/\//, '') ?? `${window.location.host}`)
    : 'localhost:3000';

const WS_BASE =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_WS_URL ??
      `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${API_HOST}`)
    : 'ws://localhost:3000';

const RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;
const MAX_RECONNECT_ATTEMPTS = 5;

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'failed';

export function Terminal() {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(RECONNECT_DELAY_MS);
  const reconnectAttemptRef = useRef(0);
  const mountedRef = useRef(true);
  const connectRef = useRef<(() => void) | null>(null);

  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);

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
      reconnectAttemptRef.current = 0;
      setReconnectAttempt(0);

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
        const msg = JSON.parse(event.data as string) as {
          type: string;
          data?: string;
          code?: string;
          message?: string;
        };
        if (msg.type === 'output') {
          term.write(msg.data ?? '');
        } else if (msg.type === 'error') {
          // Support both legacy `data` field and structured `code`/`message` format
          const errorText = msg.message ?? msg.data ?? 'Unknown error';
          const prefix = msg.code ? `[${msg.code}] ` : '';
          term.write(`\r\n\x1b[31m${prefix}${errorText}\x1b[0m`);
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
      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      setReconnectAttempt(attempt);

      if (attempt > MAX_RECONNECT_ATTEMPTS) {
        setStatus('failed');
      } else {
        setStatus('reconnecting');
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          reconnectTimerRef.current = null;
          connectRef.current?.();
        }, delay);
      }
    };

    ws.onerror = () => {
      // Explicitly close so onclose always fires and triggers reconnect
      ws.close();
    };
  }, [sendResize]);

  // Keep ref in sync so reconnect timers always call the latest
  // version of connect (which closes over current sendResize).
  // Placed in useEffect to avoid mutating a ref during render,
  // which is unsafe under React's concurrent / StrictMode semantics.
  useEffect(() => {
    connectRef.current = connect;
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

  const handleManualRetry = useCallback(() => {
    reconnectAttemptRef.current = 0;
    setReconnectAttempt(0);
    reconnectDelayRef.current = RECONNECT_DELAY_MS;
    connect();
  }, [connect]);

  return (
    <div className="relative flex h-full flex-col">
      {/* Status indicator */}
      <div className="flex items-center gap-2 border-b border-border bg-background/80 px-4 py-2 backdrop-blur-sm">
        <div
          className={cn(
            'h-2 w-2 rounded-full',
            status === 'connected' && 'bg-green-500',
            status === 'connecting' && 'animate-pulse bg-yellow-500',
            status === 'reconnecting' && 'animate-pulse bg-yellow-500',
            status === 'failed' && 'bg-red-500',
          )}
        />
        <span className="text-xs text-muted-foreground">
          {status === 'connected' && 'Connected'}
          {status === 'connecting' && 'Connecting…'}
          {status === 'reconnecting' &&
            `Reconnecting… (attempt ${reconnectAttempt}/${MAX_RECONNECT_ATTEMPTS})`}
          {status === 'failed' && 'Unable to reach the backend — is the API server running?'}
        </span>
        {status === 'failed' && (
          <button
            onClick={handleManualRetry}
            className="ml-2 rounded border border-border bg-background px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-muted"
          >
            Retry
          </button>
        )}
      </div>

      {/* Full error banner when backend is unreachable */}
      {status === 'failed' && (
        <div className="flex items-center gap-2 border-b border-red-500/30 bg-red-950/40 px-4 py-2 text-xs text-red-400">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4 shrink-0"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            Failed to connect after {MAX_RECONNECT_ATTEMPTS} attempts. Check that the API server is
            running and accessible.
          </span>
        </div>
      )}

      {/* Terminal container */}
      <div
        ref={containerRef}
        className="min-h-0 flex-1 bg-[#0a0a0f] p-1"
        style={{ overflow: 'hidden' }}
      />
    </div>
  );
}
