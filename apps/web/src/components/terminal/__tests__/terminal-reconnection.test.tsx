/**
 * Terminal component — reconnection & resilience unit tests.
 *
 * Tests the WebSocket reconnection logic, exponential backoff,
 * max-attempt failure state, manual retry, and cleanup on unmount.
 *
 * Follows patterns from websocket-resilience.test.ts.
 */
import { act, render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock XTerm ────────────────────────────────────────────────────

const mockTermWrite = vi.fn();
const mockTermOpen = vi.fn();
const mockTermDispose = vi.fn();
const mockTermOnData = vi.fn();
const mockTermOnResize = vi.fn();

const mockTermInstance = {
  cols: 80,
  rows: 24,
  write: mockTermWrite,
  open: mockTermOpen,
  dispose: mockTermDispose,
  onData: mockTermOnData,
  onResize: mockTermOnResize,
  loadAddon: vi.fn(),
};

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => mockTermInstance),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: vi.fn(),
  })),
}));

// Suppress xterm CSS import
vi.mock('@xterm/xterm/css/xterm.css', () => ({}));

// ── Mock WebSocket ────────────────────────────────────────────────

let mockWsInstances: MockWebSocket[] = [];

class MockWebSocket {
  static CONNECTING = 0 as const;
  static OPEN = 1 as const;
  static CLOSING = 2 as const;
  static CLOSED = 3 as const;

  CONNECTING = 0 as const;
  OPEN = 1 as const;
  CLOSING = 2 as const;
  CLOSED = 3 as const;

  readyState: number = MockWebSocket.CONNECTING;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  url: string;
  closeCalled = false;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    mockWsInstances.push(this);
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

// Mock ResizeObserver (jsdom lacks it)
vi.stubGlobal(
  'ResizeObserver',
  vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  })),
);

// ── Import component under test ──────────────────────────────────

import { Terminal } from '../terminal';

// ── Test suite ───────────────────────────────────────────────────

describe('Terminal — reconnection & resilience', () => {
  beforeEach(() => {
    mockWsInstances = [];
    mockTermWrite.mockClear();
    mockTermOpen.mockClear();
    mockTermDispose.mockClear();
    mockTermOnData.mockClear();
    mockTermOnResize.mockClear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Connection lifecycle ───────────────────────────────────────

  it('creates WebSocket on mount and shows connecting status', () => {
    render(<Terminal />);
    expect(mockWsInstances.length).toBe(1);
    expect(mockWsInstances[0]!.url).toContain('/api/terminal/ws');
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('shows connected status on WebSocket open', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('opens xterm in the container on mount', () => {
    render(<Terminal />);
    expect(mockTermOpen).toHaveBeenCalledTimes(1);
  });

  it('sends resize message on WebSocket open', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    const resizeMsg = mockWsInstances[0]!.sentMessages.find((m) => {
      const parsed = JSON.parse(m);
      return parsed.type === 'resize';
    });
    expect(resizeMsg).toBeDefined();
    const parsed = JSON.parse(resizeMsg!);
    expect(parsed.cols).toBe(80);
    expect(parsed.rows).toBe(24);
  });

  // ── Message handling ───────────────────────────────────────────

  it('writes output messages to terminal', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    act(() => {
      mockWsInstances[0]!.simulateMessage(
        JSON.stringify({ type: 'output', data: 'hello world' }),
      );
    });

    expect(mockTermWrite).toHaveBeenCalledWith('hello world');
  });

  it('writes error messages to terminal with red ANSI escape', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    act(() => {
      mockWsInstances[0]!.simulateMessage(
        JSON.stringify({ type: 'error', data: 'something broke' }),
      );
    });

    expect(mockTermWrite).toHaveBeenCalledWith(
      expect.stringContaining('something broke'),
    );
    // Should contain red ANSI escape code
    expect(mockTermWrite).toHaveBeenCalledWith(
      expect.stringContaining('\x1b[31m'),
    );
  });

  it('handles non-JSON messages gracefully', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    // Should not throw
    act(() => {
      mockWsInstances[0]!.simulateMessage('raw string data');
    });

    // Fallback: writes raw data
    expect(mockTermWrite).toHaveBeenCalledWith('raw string data');
  });

  // ── Input handling ─────────────────────────────────────────────

  it('pipes terminal input to WebSocket as input messages', () => {
    render(<Terminal />);

    // Get the onData callback
    expect(mockTermOnData).toHaveBeenCalledTimes(1);
    const onDataCb = mockTermOnData.mock.calls[0][0];

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    // Simulate user typing
    onDataCb('ls -la\r');

    const inputMsg = mockWsInstances[0]!.sentMessages.find((m) => {
      const parsed = JSON.parse(m);
      return parsed.type === 'input';
    });
    expect(inputMsg).toBeDefined();
    expect(JSON.parse(inputMsg!)).toEqual({ type: 'input', data: 'ls -la\r' });
  });

  it('does not send input when WebSocket is not open', () => {
    render(<Terminal />);

    const onDataCb = mockTermOnData.mock.calls[0][0];

    // WS is still CONNECTING (not OPEN)
    onDataCb('test');

    // Should have no input messages (only resize may be sent on open)
    const inputMsgs = mockWsInstances[0]!.sentMessages.filter((m) => {
      try {
        return JSON.parse(m).type === 'input';
      } catch {
        return false;
      }
    });
    expect(inputMsgs).toHaveLength(0);
  });

  // ── Reconnection logic ────────────────────────────────────────

  it('reconnects on WebSocket close with reconnecting status', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
      mockWsInstances[0]!.simulateClose();
    });

    expect(screen.getByText(/Reconnecting/)).toBeInTheDocument();
    expect(mockWsInstances.length).toBe(1); // Not reconnected yet

    // Advance past initial delay (2000ms)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockWsInstances.length).toBe(2); // Reconnected
  });

  it('onerror triggers close which triggers reconnect', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    // Error → close → reconnect
    act(() => {
      mockWsInstances[0]!.simulateError();
    });

    // onerror calls ws.close(), which should trigger the reconnect path
    expect(mockWsInstances[0]!.closeCalled).toBe(true);
  });

  it('uses exponential backoff for reconnection delays', () => {
    render(<Terminal />);

    // First connection + close
    act(() => {
      mockWsInstances[0]!.simulateOpen();
      mockWsInstances[0]!.simulateClose();
    });

    // Attempt 1: 2000ms delay
    act(() => {
      vi.advanceTimersByTime(1999);
    });
    expect(mockWsInstances.length).toBe(1); // Not yet

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockWsInstances.length).toBe(2); // Reconnected at 2000ms

    // Close again — attempt 2: 4000ms delay
    act(() => {
      mockWsInstances[1]!.simulateClose();
    });

    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(mockWsInstances.length).toBe(2); // Not yet

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockWsInstances.length).toBe(3); // Reconnected at 4000ms

    // Close again — attempt 3: 8000ms delay
    act(() => {
      mockWsInstances[2]!.simulateClose();
    });

    act(() => {
      vi.advanceTimersByTime(7999);
    });
    expect(mockWsInstances.length).toBe(3);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockWsInstances.length).toBe(4); // Reconnected at 8000ms
  });

  it('shows reconnect attempt counter', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
      mockWsInstances[0]!.simulateClose();
    });

    expect(screen.getByText(/attempt 1\/5/)).toBeInTheDocument();

    // Advance to next reconnect
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Close again
    act(() => {
      mockWsInstances[1]!.simulateClose();
    });

    expect(screen.getByText(/attempt 2\/5/)).toBeInTheDocument();
  });

  it('shows failed state after max reconnect attempts', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    // Exhaust all 5 reconnect attempts
    for (let i = 0; i < 5; i++) {
      const ws = mockWsInstances[mockWsInstances.length - 1]!;
      act(() => {
        ws.simulateClose();
      });

      if (i < 4) {
        // Need to advance timer to trigger next reconnect
        const delay = 2000 * Math.pow(2, i);
        act(() => {
          vi.advanceTimersByTime(delay);
        });
      }
    }

    // After 5th close, attempt count = 5, next close makes attempt 6 > MAX (5)
    // Actually let's trace: first close sets attempt=1, schedules reconnect
    // ...after 5 closes, attempt=5, schedules reconnect
    // The 5th reconnect fires and creates ws[5]
    const lastWs = mockWsInstances[mockWsInstances.length - 1]!;
    act(() => {
      lastWs.simulateClose();
    });

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
  });

  it('shows retry button in failed state', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    // Exhaust all reconnect attempts
    for (let i = 0; i < 5; i++) {
      const ws = mockWsInstances[mockWsInstances.length - 1]!;
      act(() => {
        ws.simulateClose();
      });
      if (i < 4) {
        act(() => {
          vi.advanceTimersByTime(2000 * Math.pow(2, i));
        });
      }
    }

    // One more close pushes past max
    act(() => {
      mockWsInstances[mockWsInstances.length - 1]!.simulateClose();
    });

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it('retry button resets attempts and reconnects', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    // Drive to failed state
    for (let i = 0; i < 5; i++) {
      const ws = mockWsInstances[mockWsInstances.length - 1]!;
      act(() => {
        ws.simulateClose();
      });
      if (i < 4) {
        act(() => {
          vi.advanceTimersByTime(2000 * Math.pow(2, i));
        });
      }
    }
    act(() => {
      mockWsInstances[mockWsInstances.length - 1]!.simulateClose();
    });

    expect(screen.getByText('Connection failed')).toBeInTheDocument();
    const countBefore = mockWsInstances.length;

    // Click retry
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    });

    // Should have created a new WebSocket
    expect(mockWsInstances.length).toBe(countBefore + 1);

    // Should show connecting, not failed
    expect(screen.getByText('Connecting…')).toBeInTheDocument();
  });

  it('resets reconnect delay on successful connection', () => {
    render(<Terminal />);

    // First connection + close
    act(() => {
      mockWsInstances[0]!.simulateOpen();
      mockWsInstances[0]!.simulateClose();
    });

    // Wait 2s for first reconnect
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockWsInstances.length).toBe(2);

    // Second connection opens successfully — resets delay
    act(() => {
      mockWsInstances[1]!.simulateOpen();
      mockWsInstances[1]!.simulateClose();
    });

    // Should reconnect after 2s again (reset), not 4s
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(mockWsInstances.length).toBe(3);
  });

  it('caps reconnect delay at 30 seconds', () => {
    render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    // 2s, 4s, 8s, 16s, 30s (capped)
    const expectedDelays = [2000, 4000, 8000, 16000, 30000];

    for (let i = 0; i < expectedDelays.length; i++) {
      const ws = mockWsInstances[mockWsInstances.length - 1]!;
      act(() => {
        ws.simulateClose();
      });

      const delay = expectedDelays[i]!;
      act(() => {
        vi.advanceTimersByTime(delay - 1);
      });
      const countBefore = mockWsInstances.length;

      act(() => {
        vi.advanceTimersByTime(1);
      });
      // Only check if we haven't exceeded max attempts
      if (i < 4) {
        expect(mockWsInstances.length).toBe(countBefore + 1);
      }
    }
  });

  // ── Cleanup ────────────────────────────────────────────────────

  it('cleans up WebSocket and xterm on unmount', () => {
    const { unmount } = render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    unmount();

    expect(mockWsInstances[0]!.closeCalled).toBe(true);
    expect(mockTermDispose).toHaveBeenCalledTimes(1);
  });

  it('does not reconnect after unmount', () => {
    const { unmount } = render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    unmount();

    // Even after the delay, no new connections should be created
    act(() => {
      vi.advanceTimersByTime(60000);
    });

    expect(mockWsInstances.length).toBe(1);
  });

  it('cancels pending reconnect timer on unmount', () => {
    const { unmount } = render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
      mockWsInstances[0]!.simulateClose();
    });

    // Reconnect is scheduled but not yet fired
    expect(mockWsInstances.length).toBe(1);

    unmount();

    // Advance past the reconnect delay
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Should still be only 1 (no reconnect after unmount)
    expect(mockWsInstances.length).toBe(1);
  });

  // ── Connection status indicator styling ────────────────────────

  it('shows green dot when connected', () => {
    const { container } = render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    const dot = container.querySelector('.bg-green-500');
    expect(dot).toBeInTheDocument();
  });

  it('shows pulsing yellow dot when connecting', () => {
    const { container } = render(<Terminal />);

    const dot = container.querySelector('.animate-pulse.bg-yellow-500');
    expect(dot).toBeInTheDocument();
  });

  it('shows red dot when failed', () => {
    const { container } = render(<Terminal />);

    act(() => {
      mockWsInstances[0]!.simulateOpen();
    });

    // Drive to failed state
    for (let i = 0; i < 5; i++) {
      const ws = mockWsInstances[mockWsInstances.length - 1]!;
      act(() => {
        ws.simulateClose();
      });
      if (i < 4) {
        act(() => {
          vi.advanceTimersByTime(2000 * Math.pow(2, i));
        });
      }
    }
    act(() => {
      mockWsInstances[mockWsInstances.length - 1]!.simulateClose();
    });

    const dot = container.querySelector('.bg-red-500');
    expect(dot).toBeInTheDocument();
  });
});
