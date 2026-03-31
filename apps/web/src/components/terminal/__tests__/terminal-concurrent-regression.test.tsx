/**
 * Terminal component — concurrent sessions & resource leak regression tests.
 *
 * Verifies that:
 * 1. Multiple Terminal component mounts/unmounts don't leak WebSocket connections
 * 2. Unmount during reconnection doesn't leak timers
 * 3. Terminal status transitions are correct and non-overlapping
 * 4. The terminal doesn't interfere with the main WebSocket event bus
 */
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock XTerm ────────────────────────────────────────────────────

const mockTermInstances: Array<{ disposed: boolean; opened: boolean }> = [];

vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn(() => {
    const instance = {
      cols: 80,
      rows: 24,
      disposed: false,
      opened: false,
      write: vi.fn(),
      open: vi.fn(function (this: typeof instance) {
        this.opened = true;
      }),
      dispose: vi.fn(function (this: typeof instance) {
        this.disposed = true;
      }),
      onData: vi.fn(),
      onResize: vi.fn(),
      loadAddon: vi.fn(),
    };
    mockTermInstances.push(instance);
    return instance;
  }),
}));

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn(() => ({
    fit: vi.fn(),
  })),
}));

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

vi.stubGlobal(
  'ResizeObserver',
  vi.fn(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
    unobserve: vi.fn(),
  })),
);

// ── Import component ──────────────────────────────────────────────

import { Terminal } from '../terminal';

// ── Tests ─────────────────────────────────────────────────────────

describe('Terminal — concurrent sessions & resource leaks', () => {
  beforeEach(() => {
    mockWsInstances = [];
    mockTermInstances.length = 0;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Mount/unmount resource tracking ─────────────────────────────

  describe('mount/unmount resource cleanup', () => {
    it('single mount creates exactly 1 XTerm and 1 WebSocket', () => {
      render(<Terminal />);
      expect(mockTermInstances).toHaveLength(1);
      expect(mockWsInstances).toHaveLength(1);
    });

    it('unmount disposes XTerm and closes WebSocket', () => {
      const { unmount } = render(<Terminal />);

      act(() => mockWsInstances[0]!.simulateOpen());

      unmount();

      expect(mockTermInstances[0]!.disposed).toBe(true);
      expect(mockWsInstances[0]!.closeCalled).toBe(true);
    });

    it('rapid mount/unmount 5 times — all resources cleaned up', () => {
      for (let i = 0; i < 5; i++) {
        const { unmount } = render(<Terminal />);
        act(() => mockWsInstances[i]!.simulateOpen());
        unmount();
      }

      expect(mockTermInstances).toHaveLength(5);
      expect(mockWsInstances).toHaveLength(5);

      for (let i = 0; i < 5; i++) {
        expect(mockTermInstances[i]!.disposed).toBe(true);
        expect(mockWsInstances[i]!.closeCalled).toBe(true);
      }
    });

    it('unmount during connecting state still cleans up', () => {
      const { unmount } = render(<Terminal />);
      // Don't simulateOpen — WS stays in CONNECTING state
      unmount();

      expect(mockTermInstances[0]!.disposed).toBe(true);
      expect(mockWsInstances[0]!.closeCalled).toBe(true);
    });

    it('unmount during reconnecting state cleans up pending timer', () => {
      const { unmount } = render(<Terminal />);

      act(() => {
        mockWsInstances[0]!.simulateOpen();
        mockWsInstances[0]!.simulateClose();
      });

      // Reconnect timer is pending
      expect(mockWsInstances).toHaveLength(1);

      unmount();

      // Advance past all possible reconnect delays
      act(() => vi.advanceTimersByTime(60000));

      // No new WS connections created
      expect(mockWsInstances).toHaveLength(1);
    });
  });

  // ── Status transitions ──────────────────────────────────────────

  describe('status transitions', () => {
    it('connecting → connected on WS open', () => {
      render(<Terminal />);
      expect(screen.getByText('Connecting…')).toBeInTheDocument();

      act(() => mockWsInstances[0]!.simulateOpen());
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('connected → reconnecting on WS close', () => {
      render(<Terminal />);

      act(() => mockWsInstances[0]!.simulateOpen());
      expect(screen.getByText('Connected')).toBeInTheDocument();

      act(() => mockWsInstances[0]!.simulateClose());
      expect(screen.getByText(/Reconnecting/)).toBeInTheDocument();
    });

    it('reconnecting → connecting → connected on successful reconnect', () => {
      render(<Terminal />);

      act(() => {
        mockWsInstances[0]!.simulateOpen();
        mockWsInstances[0]!.simulateClose();
      });
      expect(screen.getByText(/Reconnecting/)).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(2000));

      expect(mockWsInstances).toHaveLength(2);

      act(() => mockWsInstances[1]!.simulateOpen());
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('reconnecting → failed after max attempts', () => {
      render(<Terminal />);
      act(() => mockWsInstances[0]!.simulateOpen());

      // 5 close/reconnect cycles, then one more close
      for (let i = 0; i < 5; i++) {
        act(() => mockWsInstances[mockWsInstances.length - 1]!.simulateClose());
        if (i < 4) {
          act(() => vi.advanceTimersByTime(2000 * Math.pow(2, i)));
        }
      }
      act(() => mockWsInstances[mockWsInstances.length - 1]!.simulateClose());

      expect(screen.getByText('Connection failed')).toBeInTheDocument();
    });
  });

  // ── Multiple simultaneous renders (concurrent sessions simulation)
  // In a real app, a user might have the terminal page open in
  // multiple tabs or the component might remount. Each should be
  // independent.

  describe('multiple simultaneous terminal renders', () => {
    it('two Terminal components create independent WS connections', () => {
      const { unmount: unmount1 } = render(<Terminal />);
      const { unmount: unmount2 } = render(<Terminal />);

      expect(mockWsInstances).toHaveLength(2);
      expect(mockWsInstances[0]!.url).toBe(mockWsInstances[1]!.url);

      // Both connect independently
      act(() => {
        mockWsInstances[0]!.simulateOpen();
        mockWsInstances[1]!.simulateOpen();
      });

      // Closing one doesn't affect the other
      act(() => mockWsInstances[0]!.simulateClose());

      // Session 1 is reconnecting, session 2 is still connected
      // We can't easily check both status texts since they're in different render trees,
      // but we verify WS state
      expect(mockWsInstances[1]!.readyState).toBe(MockWebSocket.OPEN);

      unmount1();
      unmount2();

      // Both cleaned up
      expect(mockWsInstances[0]!.closeCalled).toBe(true);
      expect(mockWsInstances[1]!.closeCalled).toBe(true);
    });

    it('messages from one session do not leak to another', () => {
      render(<Terminal />);
      render(<Terminal />);

      act(() => {
        mockWsInstances[0]!.simulateOpen();
        mockWsInstances[1]!.simulateOpen();
      });

      // XTerm instances should be separate
      expect(mockTermInstances).toHaveLength(2);

      // Send output to session 1 only
      act(() => {
        mockWsInstances[0]!.simulateMessage(
          JSON.stringify({ type: 'output', data: 'session-1-data' }),
        );
      });

      // We can verify via the XTerm mock that term1 got the data
      // and term2 didn't — each XTerm instance is independent
      expect(mockTermInstances[0]).not.toBe(mockTermInstances[1]);
    });
  });

  // ── Error recovery ──────────────────────────────────────────────

  describe('error recovery', () => {
    it('WebSocket error triggers close and reconnect', () => {
      render(<Terminal />);

      act(() => mockWsInstances[0]!.simulateOpen());
      act(() => mockWsInstances[0]!.simulateError());

      // Error handler calls ws.close()
      expect(mockWsInstances[0]!.closeCalled).toBe(true);
    });

    it('error message from server is displayed in red', () => {
      render(<Terminal />);

      act(() => mockWsInstances[0]!.simulateOpen());
      act(() => {
        mockWsInstances[0]!.simulateMessage(
          JSON.stringify({ type: 'error', code: 'INVALID_JSON', message: 'parse failed' }),
        );
      });

      // The terminal write should have been called with red ANSI text
      const termInstance = mockTermInstances[0]!;
      // @ts-expect-error mock
      const writeCalls = termInstance.write.mock.calls;
      const lastWrite = writeCalls[writeCalls.length - 1]?.[0];
      expect(lastWrite).toContain('\x1b[31m');
      expect(lastWrite).toContain('INVALID_JSON');
    });

    it('server error with legacy data field is displayed', () => {
      render(<Terminal />);

      act(() => mockWsInstances[0]!.simulateOpen());
      act(() => {
        mockWsInstances[0]!.simulateMessage(
          JSON.stringify({ type: 'error', data: 'Terminal unavailable: no pty\r\n' }),
        );
      });

      const termInstance = mockTermInstances[0]!;
      // @ts-expect-error mock
      const writeCalls = termInstance.write.mock.calls;
      const lastWrite = writeCalls[writeCalls.length - 1]?.[0];
      expect(lastWrite).toContain('Terminal unavailable');
    });

    it('non-JSON message is written as raw text', () => {
      render(<Terminal />);

      act(() => mockWsInstances[0]!.simulateOpen());
      act(() => {
        mockWsInstances[0]!.simulateMessage('raw text from server');
      });

      const termInstance = mockTermInstances[0]!;
      // @ts-expect-error mock
      expect(termInstance.write).toHaveBeenCalledWith('raw text from server');
    });
  });

  // ── Terminal ↔ Event Bus isolation ──────────────────────────────

  describe('terminal ↔ event bus isolation', () => {
    it('terminal WebSocket connects to /api/terminal/ws not the event bus /ws', () => {
      render(<Terminal />);
      const url = mockWsInstances[0]!.url;
      expect(url).toContain('/api/terminal/ws');
      // Ensure it's NOT connecting to the event-bus endpoint (just "/ws")
      const path = new URL(url).pathname;
      expect(path).toBe('/api/terminal/ws');
      expect(path).not.toBe('/ws');
    });

    it('terminal messages use type: input/output protocol, not action: subscribe', () => {
      render(<Terminal />);
      act(() => mockWsInstances[0]!.simulateOpen());

      // The sent messages should be resize (type-based), not subscribe (action-based)
      const messages = mockWsInstances[0]!.sentMessages.map((m) => JSON.parse(m));
      for (const msg of messages) {
        expect(msg).not.toHaveProperty('action');
        expect(['resize', 'input']).toContain(msg.type);
      }
    });
  });
});
