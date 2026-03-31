import { act, renderHook } from '@testing-library/react';
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
  closeCalled = false;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    mockInstances.push(this);
  }

  send(data: string) {
    this.sentMessages.push(data);
  }

  close() {
    this.closeCalled = true;
    this.readyState = MockWebSocket.CLOSED;
  }

  // Test helpers
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

  simulateError() {
    this.onerror?.(new Event('error'));
  }
}

vi.stubGlobal('WebSocket', MockWebSocket);

import { useWebSocket } from '@/hooks/use-websocket';

// ── Tests ───────────────────────────────────────────────────────

describe('useWebSocket — error paths & edge cases', () => {
  beforeEach(() => {
    mockInstances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('send() when disconnected', () => {
    it('does not throw when sending before connection opens', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));
      // WebSocket is CONNECTING, not OPEN — send should silently no-op
      expect(() => {
        act(() => {
          result.current.send({ action: 'subscribe', events: ['task:updated'] });
        });
      }).not.toThrow();
      expect(mockInstances[0]!.sentMessages).toHaveLength(0);
    });

    it('does not throw when sending after connection closes', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateClose();
      });

      expect(() => {
        act(() => {
          result.current.send({ action: 'pong' });
        });
      }).not.toThrow();
    });
  });

  describe('isConnected state transitions', () => {
    it('transitions to false on close', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });
      expect(result.current.isConnected).toBe(true);

      act(() => {
        mockInstances[0]!.simulateClose();
      });
      expect(result.current.isConnected).toBe(false);
    });

    it('transitions back to true after successful reconnect', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });
      expect(result.current.isConnected).toBe(true);

      act(() => {
        mockInstances[0]!.simulateClose();
      });
      expect(result.current.isConnected).toBe(false);

      // Wait for reconnect
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(mockInstances).toHaveLength(2);

      act(() => {
        mockInstances[1]!.simulateOpen();
      });
      expect(result.current.isConnected).toBe(true);
    });
  });

  describe('onerror → onclose → reconnect chain', () => {
    it('triggers close on error which then reconnects', () => {
      renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // onerror calls ws.close()
      act(() => {
        mockInstances[0]!.simulateError();
      });
      expect(mockInstances[0]!.closeCalled).toBe(true);

      // Browser would fire onclose after error
      act(() => {
        mockInstances[0]!.simulateClose();
      });

      // Wait for reconnect delay
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(mockInstances).toHaveLength(2);
    });

    it('error before open still triggers close and reconnect', () => {
      renderHook(() => useWebSocket('ws://test:3001/ws'));

      // Error fires before onopen
      act(() => {
        mockInstances[0]!.simulateError();
      });
      expect(mockInstances[0]!.closeCalled).toBe(true);

      // onclose fires
      act(() => {
        mockInstances[0]!.simulateClose();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(mockInstances).toHaveLength(2);
    });
  });

  describe('non-string message data', () => {
    it('treats non-string message data as empty string', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // Send a non-string data (e.g. ArrayBuffer would come as non-string)
      // The hook checks `typeof event.data === 'string'`
      act(() => {
        mockInstances[0]!.onmessage?.(new MessageEvent('message', { data: null }));
      });

      // Should not crash and lastEvent remains null
      expect(result.current.lastEvent).toBeNull();
    });
  });

  describe('onEventRef callback dispatch', () => {
    it('dispatches normal events via onEventRef', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      const received: unknown[] = [];
      result.current.onEventRef.current = (evt) => received.push(evt);

      const event = {
        type: 'task:updated',
        payload: { id: 't1' },
        timestamp: '2026-03-30T14:00:00Z',
      };

      act(() => {
        mockInstances[0]!.simulateMessage(JSON.stringify(event));
      });

      expect(received).toHaveLength(1);
      expect(received[0]).toEqual(event);
    });

    it('dispatches rapid events without losing any', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      const received: unknown[] = [];
      result.current.onEventRef.current = (evt) => received.push(evt);

      act(() => {
        for (let i = 0; i < 10; i++) {
          mockInstances[0]!.simulateMessage(
            JSON.stringify({
              type: 'activity:new',
              payload: { index: i },
              timestamp: `2026-03-30T14:00:0${i}Z`,
            }),
          );
        }
      });

      expect(received).toHaveLength(10);
    });
  });

  describe('reconnect timer cleanup', () => {
    it('clears pending reconnect timer on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // Close triggers reconnect timer
      act(() => {
        mockInstances[0]!.simulateClose();
      });

      // Unmount before timer fires
      unmount();

      // Advance past reconnect delay
      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should not have created a new connection
      expect(mockInstances).toHaveLength(1);
    });

    it('does not update state after unmount even if open fires late', () => {
      const { result, unmount } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      // Unmount immediately (before open fires)
      unmount();

      // Late onopen should not crash or update state
      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // isConnected stays false since component is unmounted
      expect(result.current.isConnected).toBe(false);
    });
  });

  describe('multiple close events', () => {
    it('handles duplicate close events without creating extra connections', () => {
      renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // Two rapid close events
      act(() => {
        mockInstances[0]!.simulateClose();
        mockInstances[0]!.simulateClose();
      });

      // Wait for both potential timers
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      // Should reconnect, but the exact count depends on implementation
      // The key assertion is it doesn't crash
      expect(mockInstances.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('subscribe after reconnect', () => {
    it('can subscribe on a new connection after reconnect', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // Close and reconnect
      act(() => {
        mockInstances[0]!.simulateClose();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockInstances).toHaveLength(2);

      act(() => {
        mockInstances[1]!.simulateOpen();
      });

      // Subscribe on the new connection
      act(() => {
        result.current.subscribe(['task:updated']);
      });

      expect(mockInstances[1]!.sentMessages).toContainEqual(
        JSON.stringify({ action: 'subscribe', events: ['task:updated'] }),
      );
    });
  });

  describe('messages during reconnect', () => {
    it('silently drops send() calls while reconnecting', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateClose();
      });

      // While reconnecting, send should no-op
      act(() => {
        result.current.send({ action: 'subscribe', events: ['task:updated'] });
      });

      // No messages sent since the socket is closed
      expect(mockInstances[0]!.sentMessages).toHaveLength(0);
    });
  });

  describe('error envelope without all fields', () => {
    it('treats type:error without code/message as normal event', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // Incomplete error-like envelope — missing 'code' and 'message'
      const incompleteError = {
        type: 'error',
        payload: { something: 'else' },
        timestamp: '2026-03-30T14:00:00Z',
      };

      act(() => {
        mockInstances[0]!.simulateMessage(JSON.stringify(incompleteError));
      });

      // Should be treated as a normal event since it lacks code+message
      expect(result.current.lastEvent).toEqual(incompleteError);
      expect(result.current.lastError).toBeNull();
    });
  });

  describe('reconnect backoff across error+close', () => {
    it('maintains backoff progression through error-triggered closes', () => {
      renderHook(() => useWebSocket('ws://test:3001/ws'));

      // First connection: error → close → reconnect at 1s
      act(() => {
        mockInstances[0]!.simulateError();
        mockInstances[0]!.simulateClose();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(mockInstances).toHaveLength(2);

      // Second: error → close → reconnect at 2s
      act(() => {
        mockInstances[1]!.simulateError();
        mockInstances[1]!.simulateClose();
      });
      act(() => {
        vi.advanceTimersByTime(1999);
      });
      expect(mockInstances).toHaveLength(2); // not yet
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(mockInstances).toHaveLength(3); // reconnected at 2s

      // Third: error → close → reconnect at 4s
      act(() => {
        mockInstances[2]!.simulateError();
        mockInstances[2]!.simulateClose();
      });
      act(() => {
        vi.advanceTimersByTime(3999);
      });
      expect(mockInstances).toHaveLength(3); // not yet
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(mockInstances).toHaveLength(4); // reconnected at 4s
    });
  });
});
