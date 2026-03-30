import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Create mock WebSocket before importing the hook
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

// Mock WebSocket globally
vi.stubGlobal('WebSocket', MockWebSocket);

import { useWebSocket } from '@/hooks/use-websocket';

describe('useWebSocket — Reconnection + Resilience', () => {
  beforeEach(() => {
    mockInstances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('connects to WebSocket on mount', () => {
    renderHook(() => useWebSocket('ws://test:3001/ws'));
    expect(mockInstances.length).toBe(1);
    expect(mockInstances[0]!.url).toBe('ws://test:3001/ws');
  });

  it('sets isConnected to true on open', () => {
    const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));
    expect(result.current.isConnected).toBe(false);

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('auto-reconnects on close with exponential backoff', () => {
    renderHook(() => useWebSocket('ws://test:3001/ws'));
    const ws1 = mockInstances[0]!;

    // Open and then close
    act(() => {
      ws1!.simulateOpen();
      ws1!.simulateClose();
    });

    expect(mockInstances.length).toBe(1); // Not reconnected yet

    // Advance 1 second (initial delay)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockInstances.length).toBe(2); // Reconnected

    // Close again — next delay should be 2s
    act(() => {
      mockInstances[1]!.simulateClose();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances.length).toBe(2); // Not yet — need 2s

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances.length).toBe(3); // Now reconnected at 2s
  });

  it('resets reconnect delay on successful connection', () => {
    renderHook(() => useWebSocket('ws://test:3001/ws'));

    // First connection + close
    act(() => {
      mockInstances[0]!.simulateOpen();
      mockInstances[0]!.simulateClose();
    });

    // Wait 1s for first reconnect
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances.length).toBe(2);

    // Second connection opens successfully, then closes
    act(() => {
      mockInstances[1]!.simulateOpen(); // This resets the delay
      mockInstances[1]!.simulateClose();
    });

    // Should reconnect after 1s again (reset), not 2s
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances.length).toBe(3);
  });

  it('handles error by closing the WebSocket', () => {
    renderHook(() => useWebSocket('ws://test:3001/ws'));
    const ws = mockInstances[0]!;

    act(() => {
      ws!.simulateOpen();
      ws!.simulateError();
    });

    expect(ws!.closeCalled).toBe(true);
  });

  it('parses JSON messages and sets lastEvent', () => {
    const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    const event = {
      type: 'task:updated',
      payload: { id: 't1', status: 'done' },
      timestamp: '2026-03-24T00:00:00Z',
    };

    act(() => {
      mockInstances[0]!.simulateMessage(JSON.stringify(event));
    });

    expect(result.current.lastEvent).toEqual(event);
  });

  it('responds to ping with pong', () => {
    renderHook(() => useWebSocket('ws://test:3001/ws'));

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    act(() => {
      mockInstances[0]!.simulateMessage('ping');
    });

    // Should have sent a pong
    expect(mockInstances[0]!.sentMessages).toContainEqual(JSON.stringify({ action: 'pong' }));
  });

  it('ignores malformed JSON messages without crashing', () => {
    const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    // Should not throw
    act(() => {
      mockInstances[0]!.simulateMessage('this is not json');
    });

    expect(result.current.lastEvent).toBeNull();
  });

  it('cleans up WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket('ws://test:3001/ws'));

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    unmount();

    expect(mockInstances[0]!.closeCalled).toBe(true);
  });

  it('does not reconnect after unmount', () => {
    const { unmount } = renderHook(() => useWebSocket('ws://test:3001/ws'));

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    unmount();

    // Even after the delay, no new connections should be created
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockInstances.length).toBe(1);
  });

  it('caps reconnect delay at 30 seconds', () => {
    renderHook(() => useWebSocket('ws://test:3001/ws'));

    // Simulate many consecutive failures: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    for (let i = 0; i < 6; i++) {
      const current = mockInstances[mockInstances.length - 1]!;
      act(() => {
        current.simulateClose();
      });
      const delay = Math.min(1000 * 2 ** i, 30000);
      act(() => {
        vi.advanceTimersByTime(delay);
      });
    }

    // After 6 failures, delay should be capped at 30s
    const current = mockInstances[mockInstances.length - 1]!;
    act(() => {
      current.simulateClose();
    });

    // At 30s, it should reconnect
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    const count = mockInstances.length;

    // Another failure — still 30s cap
    const latest = mockInstances[mockInstances.length - 1]!;
    act(() => {
      latest.simulateClose();
    });

    act(() => {
      vi.advanceTimersByTime(29999);
    });
    expect(mockInstances.length).toBe(count); // Not yet

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockInstances.length).toBe(count + 1); // Now
  });

  describe('server error feedback', () => {
    it('sets lastError when server sends error envelope', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      const errorEnvelope = {
        type: 'error',
        code: 'INVALID_JSON',
        message: 'Message parse failed: Unexpected end of JSON input',
        timestamp: '2026-03-30T14:00:00.000Z',
      };

      act(() => {
        mockInstances[0]!.simulateMessage(JSON.stringify(errorEnvelope));
      });

      expect(result.current.lastError).toEqual(errorEnvelope);
      expect(result.current.lastEvent).toBeNull();
    });

    it('does not confuse error envelopes with regular events', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // Normal event first
      const normalEvent = {
        type: 'agent:status',
        payload: { connected: true },
        timestamp: '2026-03-30T14:00:00.000Z',
      };
      act(() => {
        mockInstances[0]!.simulateMessage(JSON.stringify(normalEvent));
      });
      expect(result.current.lastEvent).toEqual(normalEvent);

      // Error envelope
      const errorEnvelope = {
        type: 'error',
        code: 'INVALID_FORMAT',
        message: 'Message must be a JSON object',
        timestamp: '2026-03-30T14:00:01.000Z',
      };
      act(() => {
        mockInstances[0]!.simulateMessage(JSON.stringify(errorEnvelope));
      });

      // lastEvent should still be the normal event
      expect(result.current.lastEvent).toEqual(normalEvent);
      expect(result.current.lastError).toEqual(errorEnvelope);
    });

    it('fires onErrorRef callback for error envelopes', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      const errors: unknown[] = [];
      result.current.onErrorRef.current = (err) => errors.push(err);

      const errorEnvelope = {
        type: 'error',
        code: 'MISSING_ACTION',
        message: 'Message must include an "action" string field',
        timestamp: '2026-03-30T14:00:00.000Z',
      };

      act(() => {
        mockInstances[0]!.simulateMessage(JSON.stringify(errorEnvelope));
      });

      expect(errors).toHaveLength(1);
      expect(errors[0]).toEqual(errorEnvelope);
    });

    it('does not fire onEventRef for error envelopes', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      const events: unknown[] = [];
      result.current.onEventRef.current = (evt) => events.push(evt);

      const errorEnvelope = {
        type: 'error',
        code: 'UNKNOWN_ACTION',
        message: 'Unknown action: bad:thing',
        timestamp: '2026-03-30T14:00:00.000Z',
      };

      act(() => {
        mockInstances[0]!.simulateMessage(JSON.stringify(errorEnvelope));
      });

      expect(events).toHaveLength(0);
    });

    it('handles all server error codes', () => {
      const { result } = renderHook(() => useWebSocket('ws://test:3001/ws'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      const errorCodes = [
        'INVALID_JSON',
        'INVALID_FORMAT',
        'MISSING_ACTION',
        'UNKNOWN_ACTION',
        'NO_HANDLER',
        'SEND_FAILED',
      ];

      for (const code of errorCodes) {
        const errorEnvelope = {
          type: 'error',
          code,
          message: `Error: ${code}`,
          timestamp: new Date().toISOString(),
        };

        act(() => {
          mockInstances[0]!.simulateMessage(JSON.stringify(errorEnvelope));
        });

        expect(result.current.lastError?.code).toBe(code);
      }
    });
  });
});
