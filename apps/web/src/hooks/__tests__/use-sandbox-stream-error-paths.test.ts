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

  constructor(url: string) {
    this.url = url;
    mockInstances.push(this);
  }

  send(_data: string) {
    /* noop */
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

import { useSandboxStream } from '@/hooks/use-sandbox-stream';

// ── Tests ───────────────────────────────────────────────────────

describe('useSandboxStream — error paths & edge cases', () => {
  beforeEach(() => {
    mockInstances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('server error envelope', () => {
    it('sets lastError when server sends error envelope', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'error',
            code: 'SANDBOX_NOT_FOUND',
            message: 'Sandbox sb-1 does not exist',
          }),
        );
      });

      expect(result.current.lastError).toEqual({
        code: 'SANDBOX_NOT_FOUND',
        message: 'Sandbox sb-1 does not exist',
      });
    });

    it('does not add error envelope to output lines', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'error',
            code: 'RATE_LIMITED',
            message: 'Too many connections',
          }),
        );
      });

      expect(result.current.lines).toHaveLength(0);
    });

    it('updates lastError on subsequent errors', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({ type: 'error', code: 'ERR_1', message: 'First' }),
        );
      });
      expect(result.current.lastError?.code).toBe('ERR_1');

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({ type: 'error', code: 'ERR_2', message: 'Second' }),
        );
      });
      expect(result.current.lastError?.code).toBe('ERR_2');
    });
  });

  describe('line truncation at MAX_LINES (5000)', () => {
    it('truncates individual lines beyond limit', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // Send 5001 lines one at a time
      act(() => {
        for (let i = 0; i < 5001; i++) {
          mockInstances[0]!.simulateMessage(
            JSON.stringify({
              type: 'sandbox:output',
              payload: { stream: 'stdout', text: `line-${i}`, index: i, timestamp: '' },
            }),
          );
        }
      });

      expect(result.current.lines).toHaveLength(5000);
      // Oldest line should be trimmed, newest should be present
      expect(result.current.lines[result.current.lines.length - 1]!.text).toBe('line-5000');
      expect(result.current.lines[0]!.text).toBe('line-1');
    });

    it('truncates batch output beyond limit', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // Send a batch exceeding MAX_LINES
      const batch = Array.from({ length: 5500 }, (_, i) => ({
        stream: 'stdout' as const,
        text: `batch-line-${i}`,
        index: i,
        timestamp: '',
      }));

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({ type: 'sandbox:output:batch', payload: batch }),
        );
      });

      expect(result.current.lines).toHaveLength(5000);
      // Should keep the most recent lines
      expect(result.current.lines[result.current.lines.length - 1]!.text).toBe('batch-line-5499');
    });

    it('truncates when existing lines plus batch exceed limit', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      // Add 4990 lines individually
      act(() => {
        for (let i = 0; i < 4990; i++) {
          mockInstances[0]!.simulateMessage(
            JSON.stringify({
              type: 'sandbox:output',
              payload: { stream: 'stdout', text: `existing-${i}`, index: i, timestamp: '' },
            }),
          );
        }
      });
      expect(result.current.lines).toHaveLength(4990);

      // Add a batch of 20 which pushes past 5000
      const batch = Array.from({ length: 20 }, (_, i) => ({
        stream: 'stdout' as const,
        text: `new-${i}`,
        index: 4990 + i,
        timestamp: '',
      }));

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({ type: 'sandbox:output:batch', payload: batch }),
        );
      });

      expect(result.current.lines).toHaveLength(5000);
      // The last line should be the final batch line
      expect(result.current.lines[result.current.lines.length - 1]!.text).toBe('new-19');
    });
  });

  describe('lines preserved across reconnects', () => {
    it('does not clear lines when connection drops and reconnects', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'sandbox:output',
            payload: { stream: 'stdout', text: 'before-reconnect' },
          }),
        );
      });

      expect(result.current.lines).toHaveLength(1);

      // Connection drops
      act(() => {
        mockInstances[0]!.simulateClose();
      });

      // Lines still present
      expect(result.current.lines).toHaveLength(1);
      expect(result.current.lines[0]!.text).toBe('before-reconnect');

      // Reconnect happens
      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        mockInstances[1]!.simulateOpen();
      });

      // Lines still preserved
      expect(result.current.lines).toHaveLength(1);
      expect(result.current.lines[0]!.text).toBe('before-reconnect');

      // New lines appended
      act(() => {
        mockInstances[1]!.simulateMessage(
          JSON.stringify({
            type: 'sandbox:output',
            payload: { stream: 'stdout', text: 'after-reconnect' },
          }),
        );
      });

      expect(result.current.lines).toHaveLength(2);
    });
  });

  describe('error during connecting state', () => {
    it('handles error before open without crashing', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      expect(result.current.status).toBe('connecting');

      // Error before open
      act(() => {
        mockInstances[0]!.simulateError();
      });
      expect(mockInstances[0]!.closeCalled).toBe(true);

      // onclose fires
      act(() => {
        mockInstances[0]!.simulateClose();
      });

      expect(result.current.status).toBe('reconnecting');
      expect(result.current.isStreaming).toBe(false);
    });

    it('reconnects after pre-open error', () => {
      renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateError();
        mockInstances[0]!.simulateClose();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(mockInstances).toHaveLength(2);
    });
  });

  describe('sandboxId change during reconnect', () => {
    it('cancels reconnect timer when sandboxId changes mid-reconnect', () => {
      const { rerender } = renderHook(({ id }: { id: string | null }) => useSandboxStream(id), {
        initialProps: { id: 'sb-1' },
      });

      act(() => {
        mockInstances[0]!.simulateOpen();
        mockInstances[0]!.simulateClose();
      });

      // Reconnect timer is pending (1s delay)
      // Switch sandbox before timer fires
      rerender({ id: 'sb-2' });

      // Advance past the original timer
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // Should not have reconnected to sb-1, only sb-2
      const urls = mockInstances.map((ws) => ws.url);
      const sb1Connections = urls.filter((u) => u.includes('sb-1'));
      const sb2Connections = urls.filter((u) => u.includes('sb-2'));

      expect(sb1Connections).toHaveLength(1); // Only the original
      expect(sb2Connections.length).toBeGreaterThanOrEqual(1);
    });

    it('cancels reconnect timer when sandboxId becomes null', () => {
      const { result, rerender } = renderHook(
        ({ id }: { id: string | null }) => useSandboxStream(id),
        { initialProps: { id: 'sb-1' as string | null } },
      );

      act(() => {
        mockInstances[0]!.simulateOpen();
        mockInstances[0]!.simulateClose();
      });

      // Timer is pending
      rerender({ id: null });

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      // Should not reconnect, status should be idle
      expect(result.current.status).toBe('idle');
      expect(mockInstances).toHaveLength(1);
    });
  });

  describe('previous connection cleanup', () => {
    it('closes existing OPEN connection when new connect is called', () => {
      const { rerender } = renderHook(({ id }: { id: string | null }) => useSandboxStream(id), {
        initialProps: { id: 'sb-1' },
      });

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      expect(mockInstances[0]!.readyState).toBe(MockWebSocket.OPEN);

      // Switch sandbox triggers new connect → should clean up old WS
      rerender({ id: 'sb-2' });

      expect(mockInstances[0]!.closeCalled).toBe(true);
      expect(mockInstances).toHaveLength(2);
    });

    it('closes existing CONNECTING connection when new connect is called', () => {
      const { rerender } = renderHook(({ id }: { id: string | null }) => useSandboxStream(id), {
        initialProps: { id: 'sb-1' },
      });

      // Don't open — still CONNECTING
      expect(mockInstances[0]!.readyState).toBe(MockWebSocket.CONNECTING);

      rerender({ id: 'sb-2' });

      expect(mockInstances[0]!.closeCalled).toBe(true);
      expect(mockInstances).toHaveLength(2);
    });
  });

  describe('retry from reconnecting state', () => {
    it('resets and reconnects from reconnecting state', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateOpen();
        mockInstances[0]!.simulateClose();
      });

      expect(result.current.status).toBe('reconnecting');
      expect(result.current.reconnectAttempt).toBe(1);

      const countBefore = mockInstances.length;

      // Call retry while reconnecting (not just failed)
      act(() => {
        result.current.retry();
      });

      expect(result.current.reconnectAttempt).toBe(0);
      expect(mockInstances).toHaveLength(countBefore + 1);
    });
  });

  describe('rapid open/close cycles', () => {
    it('handles rapid open/close without crashing or leaking', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      // Rapid cycles
      act(() => {
        mockInstances[0]!.simulateOpen();
        mockInstances[0]!.simulateClose();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        mockInstances[1]!.simulateOpen();
        mockInstances[1]!.simulateClose();
      });

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      act(() => {
        mockInstances[2]!.simulateOpen();
        mockInstances[2]!.simulateClose();
      });

      // Each cycle should transition status correctly
      expect(result.current.status).toBe('reconnecting');
      expect(mockInstances.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('message type edge cases', () => {
    it('ignores unknown message types without crashing', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'sandbox:unknown-event',
            payload: { foo: 'bar' },
          }),
        );
      });

      expect(result.current.lines).toHaveLength(0);
      expect(result.current.lastError).toBeNull();
    });

    it('handles empty batch gracefully', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({ type: 'sandbox:output:batch', payload: [] }),
        );
      });

      expect(result.current.lines).toHaveLength(0);
    });

    it('handles stderr output alongside stdout', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      act(() => {
        mockInstances[0]!.simulateOpen();
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'sandbox:output',
            payload: { stream: 'stderr', text: 'error output' },
          }),
        );
      });

      act(() => {
        mockInstances[0]!.simulateMessage(
          JSON.stringify({
            type: 'sandbox:output',
            payload: { stream: 'stdout', text: 'normal output' },
          }),
        );
      });

      expect(result.current.lines).toHaveLength(2);
      expect(result.current.lines[0]!.stream).toBe('stderr');
      expect(result.current.lines[1]!.stream).toBe('stdout');
    });
  });

  describe('status transitions', () => {
    it('follows full lifecycle: idle → connecting → connected → reconnecting → failed', () => {
      const { result, rerender } = renderHook(
        ({ id }: { id: string | null }) => useSandboxStream(id),
        { initialProps: { id: null as string | null } },
      );

      expect(result.current.status).toBe('idle');

      rerender({ id: 'sb-1' });
      expect(result.current.status).toBe('connecting');

      act(() => {
        mockInstances[0]!.simulateOpen();
      });
      expect(result.current.status).toBe('connected');

      act(() => {
        mockInstances[0]!.simulateClose();
      });
      expect(result.current.status).toBe('reconnecting');

      // Exhaust reconnect attempts
      for (let i = 1; i <= 10; i++) {
        const delay = Math.min(1000 * 2 ** i, 30000);
        act(() => {
          vi.advanceTimersByTime(delay);
        });
        const ws = mockInstances[mockInstances.length - 1]!;
        act(() => {
          ws.simulateClose();
        });
      }

      expect(result.current.status).toBe('failed');
    });

    it('transitions from failed back to connecting on retry', () => {
      const { result } = renderHook(() => useSandboxStream('sb-1'));

      // Exhaust reconnect attempts to reach failed
      for (let i = 0; i <= 10; i++) {
        const ws = mockInstances[mockInstances.length - 1]!;
        act(() => {
          ws.simulateClose();
        });
        if (i < 10) {
          const delay = Math.min(1000 * 2 ** i, 30000);
          act(() => {
            vi.advanceTimersByTime(delay);
          });
        }
      }

      expect(result.current.status).toBe('failed');

      act(() => {
        result.current.retry();
      });

      // New connection started → status should be connecting
      expect(result.current.status).toBe('connecting');
    });
  });

  describe('backoff across error-triggered closes', () => {
    it('maintains backoff progression through error → close sequences', () => {
      renderHook(() => useSandboxStream('sb-1'));

      // First: error → close → 1s delay
      act(() => {
        mockInstances[0]!.simulateError();
        mockInstances[0]!.simulateClose();
      });
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(mockInstances).toHaveLength(2);

      // Second: error → close → 2s delay
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
      expect(mockInstances).toHaveLength(3);

      // Third: error → close → 4s delay
      act(() => {
        mockInstances[2]!.simulateError();
        mockInstances[2]!.simulateClose();
      });
      act(() => {
        vi.advanceTimersByTime(3999);
      });
      expect(mockInstances).toHaveLength(3);
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(mockInstances).toHaveLength(4);
    });
  });
});
