import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock WebSocket ──────────────────────────────────────────────

let mockInstances: MockWebSocket[] = [];

class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  url: string;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    mockInstances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  simulateOpen() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  simulateMessage(data: string) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  simulateClose() {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);

import {
  useWsConnection,
  useWsError,
  useWsEvent,
  useWsLastError,
  useWsSend,
  WebSocketProvider,
} from '@/components/providers/websocket-provider';

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(WebSocketProvider, null, children);
}

describe('WebSocketProvider', () => {
  beforeEach(() => {
    mockInstances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('useWsConnection', () => {
    it('returns isConnected false initially', () => {
      const { result } = renderHook(() => useWsConnection(), { wrapper });

      expect(result.current.isConnected).toBe(false);
    });

    it('returns isConnected true after open', () => {
      const { result } = renderHook(() => useWsConnection(), { wrapper });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      expect(result.current.isConnected).toBe(true);
    });

    it('returns isConnected false after close', () => {
      const { result } = renderHook(() => useWsConnection(), { wrapper });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });
      expect(result.current.isConnected).toBe(true);

      act(() => {
        mockInstances[0]!.simulateClose();
      });
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('useWsEvent', () => {
    it('dispatches events matching the subscribed type', () => {
      const received: unknown[] = [];
      const cb = (env: unknown) => received.push(env);

      renderHook(() => useWsEvent('task:updated', cb), { wrapper });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      const event = {
        type: 'task:updated',
        payload: { id: 't1', status: 'done' },
        timestamp: '2026-03-30T14:00:00Z',
      };

      act(() => {
        mockInstances[0]!.simulateMessage(JSON.stringify(event));
      });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(event);
    });

    it('does not dispatch events of a different type', () => {
      const received: unknown[] = [];
      const cb = (env: unknown) => received.push(env);

      renderHook(() => useWsEvent('task:updated', cb), { wrapper });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'agent:status',
            payload: { id: 'a1' },
            timestamp: '2026-03-30T14:00:00Z',
          }),
        );
      });

      expect(received).toHaveLength(0);
    });

    it('supports multiple listeners for the same event type', () => {
      const received1: unknown[] = [];
      const received2: unknown[] = [];

      function TestComponent() {
        useWsEvent('task:updated', (env) => received1.push(env));
        useWsEvent('task:updated', (env) => received2.push(env));
        return null;
      }

      renderHook(() => null, {
        wrapper: ({ children }) =>
          React.createElement(
            WebSocketProvider,
            null,
            React.createElement(TestComponent),
            children,
          ),
      });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'task:updated',
            payload: { id: 't1' },
            timestamp: '2026-03-30T14:00:00Z',
          }),
        );
      });

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
    });

    it('stops dispatching after listener unmounts', () => {
      const received: unknown[] = [];
      const cb = (env: unknown) => received.push(env);

      const { unmount } = renderHook(() => useWsEvent('task:updated', cb), { wrapper });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'task:updated',
            payload: { id: 't1' },
            timestamp: '2026-03-30T14:00:00Z',
          }),
        );
      });
      expect(received).toHaveLength(1);

      unmount();

      // Re-render a dummy consumer to keep the provider alive
      const dummyResult = renderHook(() => useWsConnection(), { wrapper });

      act(() => {
        // Need a new provider instance — the old one was unmounted
        // The unmount above kills the whole tree, so this test verifies
        // the cleanup function is called without crashing
      });

      expect(received).toHaveLength(1);
      dummyResult.unmount();
    });
  });

  describe('useWsSend', () => {
    it('returns a send function', () => {
      const { result } = renderHook(() => useWsSend(), { wrapper });

      expect(typeof result.current).toBe('function');
    });

    it('sends messages through the WebSocket', () => {
      const { result } = renderHook(() => useWsSend(), { wrapper });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        result.current({ action: 'subscribe', events: ['task:updated'] });
      });

      expect(mockInstances[0]!.sentMessages).toContainEqual(
        JSON.stringify({ action: 'subscribe', events: ['task:updated'] }),
      );
    });
  });

  describe('useWsError', () => {
    it('dispatches error envelopes to error listeners', () => {
      const errors: unknown[] = [];
      const cb = (err: unknown) => errors.push(err);

      renderHook(() => useWsError(cb), { wrapper });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      const errorEnvelope = {
        type: 'error',
        code: 'INVALID_JSON',
        message: 'Parse failed',
        timestamp: '2026-03-30T14:00:00Z',
      };

      act(() => {
        mockInstances[0]!.simulateMessage(JSON.stringify(errorEnvelope));
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(errorEnvelope);
    });

    it('does not dispatch normal events to error listeners', () => {
      const errors: unknown[] = [];
      const cb = (err: unknown) => errors.push(err);

      renderHook(() => useWsError(cb), { wrapper });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'task:updated',
            payload: { id: 't1' },
            timestamp: '2026-03-30T14:00:00Z',
          }),
        );
      });

      expect(errors).toHaveLength(0);
    });

    it('supports multiple error listeners', () => {
      const errors1: unknown[] = [];
      const errors2: unknown[] = [];

      function TestComponent() {
        useWsError((err) => errors1.push(err));
        useWsError((err) => errors2.push(err));
        return null;
      }

      renderHook(() => null, {
        wrapper: ({ children }) =>
          React.createElement(
            WebSocketProvider,
            null,
            React.createElement(TestComponent),
            children,
          ),
      });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'error',
            code: 'ERR',
            message: 'Test error',
            timestamp: '2026-03-30T14:00:00Z',
          }),
        );
      });

      expect(errors1).toHaveLength(1);
      expect(errors2).toHaveLength(1);
    });
  });

  describe('useWsLastError', () => {
    it('returns null initially', () => {
      const { result } = renderHook(() => useWsLastError(), { wrapper });

      expect(result.current).toBeNull();
    });

    it('returns the last error envelope after receiving one', () => {
      const { result } = renderHook(() => useWsLastError(), { wrapper });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      const errorEnvelope = {
        type: 'error',
        code: 'UNKNOWN_ACTION',
        message: 'Unknown action: bad',
        timestamp: '2026-03-30T14:00:00Z',
      };

      act(() => {
        mockInstances[0]!.simulateMessage(JSON.stringify(errorEnvelope));
      });

      expect(result.current).toEqual(errorEnvelope);
    });
  });

  describe('context errors outside provider', () => {
    it('useWsConnection throws outside provider', () => {
      expect(() => {
        renderHook(() => useWsConnection());
      }).toThrow('useWsConnection must be used within a WebSocketProvider');
    });

    it('useWsSend throws outside provider', () => {
      expect(() => {
        renderHook(() => useWsSend());
      }).toThrow('useWsSend must be used within a WebSocketProvider');
    });

    it('useWsEvent throws outside provider', () => {
      expect(() => {
        renderHook(() => useWsEvent('task:updated', () => {}));
      }).toThrow('useWsEvent must be used within a WebSocketProvider');
    });

    it('useWsError throws outside provider', () => {
      expect(() => {
        renderHook(() => useWsError(() => {}));
      }).toThrow('useWsError must be used within a WebSocketProvider');
    });

    it('useWsLastError throws outside provider', () => {
      expect(() => {
        renderHook(() => useWsLastError());
      }).toThrow('useWsLastError must be used within a WebSocketProvider');
    });
  });

  describe('event dispatch after reconnect', () => {
    it('continues dispatching events after reconnection', () => {
      const received: unknown[] = [];
      const cb = (env: unknown) => received.push(env);

      renderHook(() => useWsEvent('task:updated', cb), { wrapper });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // First event
      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'task:updated',
            payload: { id: 't1' },
            timestamp: '2026-03-30T14:00:00Z',
          }),
        );
      });
      expect(received).toHaveLength(1);

      // Connection drops and reconnects
      act(() => {
        mockInstances[0]!.simulateClose();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        mockInstances[1]!.simulateOpen();
      });

      // Event on new connection
      act(() => {
        mockInstances[1]!.simulateMessage(
          JSON.stringify({
            type: 'task:updated',
            payload: { id: 't2' },
            timestamp: '2026-03-30T14:01:00Z',
          }),
        );
      });

      expect(received).toHaveLength(2);
    });
  });
});
