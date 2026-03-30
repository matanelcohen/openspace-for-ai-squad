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

describe('useSandboxStream — Reconnection + Resilience', () => {
  beforeEach(() => {
    mockInstances = [];
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts idle when sandboxId is null', () => {
    const { result } = renderHook(() => useSandboxStream(null));
    expect(result.current.status).toBe('idle');
    expect(result.current.isStreaming).toBe(false);
    expect(mockInstances).toHaveLength(0);
  });

  it('connects and transitions to connected on open', () => {
    const { result } = renderHook(() => useSandboxStream('sb-1'));
    expect(mockInstances).toHaveLength(1);
    expect(mockInstances[0]!.url).toContain('/ws/sandboxes/sb-1/stream');
    expect(result.current.status).toBe('connecting');

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    expect(result.current.status).toBe('connected');
    expect(result.current.isStreaming).toBe(true);
  });

  it('accumulates output lines from sandbox:output messages', () => {
    const { result } = renderHook(() => useSandboxStream('sb-1'));

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    act(() => {
      mockInstances[0]!.simulateMessage(
        JSON.stringify({
          type: 'sandbox:output',
          payload: { stream: 'stdout', text: 'hello' },
        }),
      );
    });

    expect(result.current.lines).toHaveLength(1);
    expect(result.current.lines[0]).toEqual({ stream: 'stdout', text: 'hello' });
  });

  it('accumulates batch output lines', () => {
    const { result } = renderHook(() => useSandboxStream('sb-1'));

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    act(() => {
      mockInstances[0]!.simulateMessage(
        JSON.stringify({
          type: 'sandbox:output:batch',
          payload: [
            { stream: 'stdout', text: 'line1' },
            { stream: 'stderr', text: 'line2' },
          ],
        }),
      );
    });

    expect(result.current.lines).toHaveLength(2);
  });

  it('auto-reconnects on close with exponential backoff', () => {
    renderHook(() => useSandboxStream('sb-1'));
    const ws1 = mockInstances[0]!;

    act(() => {
      ws1.simulateOpen();
      ws1.simulateClose();
    });

    expect(mockInstances).toHaveLength(1); // Not reconnected yet

    // Advance 1s (initial delay)
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(mockInstances).toHaveLength(2); // Reconnected

    // Close again — next delay is 2s
    act(() => {
      mockInstances[1]!.simulateClose();
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(2); // Not yet

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(3); // Reconnected at 2s
  });

  it('resets reconnect delay on successful connection', () => {
    renderHook(() => useSandboxStream('sb-1'));

    // First connection + close
    act(() => {
      mockInstances[0]!.simulateOpen();
      mockInstances[0]!.simulateClose();
    });

    // 1s → reconnect
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(2);

    // Second connection succeeds then closes → delay resets
    act(() => {
      mockInstances[1]!.simulateOpen(); // resets delay
      mockInstances[1]!.simulateClose();
    });

    // Should reconnect after 1s (reset), not 2s
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(3);
  });

  it('transitions to failed after MAX_RECONNECT_ATTEMPTS', () => {
    const { result } = renderHook(() => useSandboxStream('sb-1'));

    // Exhaust 10 reconnect attempts (close without open)
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
    expect(result.current.isStreaming).toBe(false);
  });

  it('shows reconnecting status with attempt count', () => {
    const { result } = renderHook(() => useSandboxStream('sb-1'));

    act(() => {
      mockInstances[0]!.simulateOpen();
      mockInstances[0]!.simulateClose();
    });

    expect(result.current.status).toBe('reconnecting');
    expect(result.current.reconnectAttempt).toBe(1);
  });

  it('error triggers close which triggers reconnect', () => {
    renderHook(() => useSandboxStream('sb-1'));

    act(() => {
      mockInstances[0]!.simulateOpen();
      mockInstances[0]!.simulateError(); // calls ws.close() which fires onclose
    });

    // The mock's close() doesn't fire onclose, but the onerror handler calls ws.close()
    // and the actual browser would fire onclose. Simulate the close event.
    act(() => {
      mockInstances[0]!.simulateClose();
    });

    // After delay, should reconnect
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockInstances).toHaveLength(2);
  });

  it('retry() resets attempts and reconnects immediately', () => {
    const { result } = renderHook(() => useSandboxStream('sb-1'));

    // Exhaust attempts to reach failed state
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
    const countBefore = mockInstances.length;

    // Manual retry
    act(() => {
      result.current.retry();
    });

    expect(mockInstances).toHaveLength(countBefore + 1);
    expect(result.current.reconnectAttempt).toBe(0);
  });

  it('clear() empties accumulated lines', () => {
    const { result } = renderHook(() => useSandboxStream('sb-1'));

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    act(() => {
      mockInstances[0]!.simulateMessage(
        JSON.stringify({
          type: 'sandbox:output',
          payload: { stream: 'stdout', text: 'hello' },
        }),
      );
    });

    expect(result.current.lines).toHaveLength(1);

    act(() => {
      result.current.clear();
    });

    expect(result.current.lines).toHaveLength(0);
  });

  it('cleans up WebSocket and timers on unmount', () => {
    const { unmount } = renderHook(() => useSandboxStream('sb-1'));

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    unmount();

    expect(mockInstances[0]!.closeCalled).toBe(true);

    // No reconnection after unmount
    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(mockInstances).toHaveLength(1);
  });

  it('does not reconnect after unmount even if close fires', () => {
    const { unmount } = renderHook(() => useSandboxStream('sb-1'));

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    // Start a close that would normally trigger reconnect
    act(() => {
      mockInstances[0]!.simulateClose();
    });

    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Only original WS, no reconnects
    expect(mockInstances).toHaveLength(1);
  });

  it('resets state when sandboxId changes', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useSandboxStream(id),
      { initialProps: { id: 'sb-1' } },
    );

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    expect(result.current.status).toBe('connected');

    // Switch sandbox
    rerender({ id: 'sb-2' });

    // Old WS closed, new one created
    expect(mockInstances[0]!.closeCalled).toBe(true);
    expect(mockInstances).toHaveLength(2);
    expect(mockInstances[1]!.url).toContain('/ws/sandboxes/sb-2/stream');
  });

  it('caps reconnect delay at 30 seconds', () => {
    renderHook(() => useSandboxStream('sb-1'));

    // Simulate 6 consecutive failures: 1s, 2s, 4s, 8s, 16s, 30s (capped)
    for (let i = 0; i < 6; i++) {
      const ws = mockInstances[mockInstances.length - 1]!;
      act(() => {
        ws.simulateClose();
      });
      const delay = Math.min(1000 * 2 ** i, 30000);
      act(() => {
        vi.advanceTimersByTime(delay);
      });
    }

    // After 6 failures, delay should be capped at 30s
    const ws = mockInstances[mockInstances.length - 1]!;
    act(() => {
      ws.simulateClose();
    });

    // At 30s it should reconnect
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
    expect(mockInstances).toHaveLength(count); // Not yet

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockInstances).toHaveLength(count + 1); // Now
  });

  it('ignores non-JSON messages without crashing', () => {
    const { result } = renderHook(() => useSandboxStream('sb-1'));

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    // Should not throw
    act(() => {
      mockInstances[0]!.simulateMessage('not json');
    });

    expect(result.current.lines).toHaveLength(0);
  });

  it('returns to idle when sandboxId becomes null', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string | null }) => useSandboxStream(id),
      { initialProps: { id: 'sb-1' as string | null } },
    );

    act(() => {
      mockInstances[0]!.simulateOpen();
    });

    expect(result.current.status).toBe('connected');

    rerender({ id: null });

    expect(result.current.status).toBe('idle');
    expect(result.current.isStreaming).toBe(false);
  });
});
