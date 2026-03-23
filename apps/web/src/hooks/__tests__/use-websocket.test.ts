import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useWebSocket } from '@/hooks/use-websocket';

// --- Mock WebSocket ---

type WsHandler = ((ev: { data: string }) => void) | null;

class MockWebSocket {
  static readonly OPEN = 1;
  static readonly CLOSED = 3;
  static instances: MockWebSocket[] = [];

  url: string;
  readyState = MockWebSocket.OPEN;
  onopen: (() => void) | null = null;
  onmessage: WsHandler = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  sent: string[] = [];

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);

    // Simulate async open
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 0);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
  }

  // Test helpers
  simulateMessage(data: string) {
    if (this.onmessage) this.onmessage({ data });
  }

  simulateClose() {
    if (this.onclose) this.onclose();
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    MockWebSocket.instances = [];
    vi.stubGlobal('WebSocket', MockWebSocket);
    // Expose OPEN/CLOSED on the global so the hook can reference WebSocket.OPEN
    (globalThis as Record<string, unknown>).WebSocket = Object.assign(
      MockWebSocket,
      { OPEN: 1, CLOSED: 3 },
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('connects to the provided URL', () => {
    renderHook(() => useWebSocket('ws://test:1234/ws'));

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe('ws://test:1234/ws');
  });

  it('sets isConnected to true after open', async () => {
    const { result } = renderHook(() => useWebSocket('ws://test:1234/ws'));

    expect(result.current.isConnected).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('parses valid JSON messages and updates lastEvent', async () => {
    const { result } = renderHook(() => useWebSocket('ws://test:1234/ws'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    const envelope = {
      type: 'activity:new',
      payload: { id: '1' },
      timestamp: '2024-01-01T00:00:00Z',
    };

    act(() => {
      MockWebSocket.instances[0].simulateMessage(JSON.stringify(envelope));
    });

    expect(result.current.lastEvent).toEqual(envelope);
  });

  it('responds to ping with pong', async () => {
    const { result } = renderHook(() => useWebSocket('ws://test:1234/ws'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    // Ensure connected so send works
    expect(result.current.isConnected).toBe(true);

    act(() => {
      MockWebSocket.instances[0].simulateMessage('ping');
    });

    const ws = MockWebSocket.instances[0];
    expect(ws.sent).toContainEqual(JSON.stringify({ action: 'pong' }));
  });

  it('does not update lastEvent for ping messages', async () => {
    const { result } = renderHook(() => useWebSocket('ws://test:1234/ws'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    act(() => {
      MockWebSocket.instances[0].simulateMessage('ping');
    });

    expect(result.current.lastEvent).toBeNull();
  });

  it('reconnects on close with exponential backoff', async () => {
    renderHook(() => useWebSocket('ws://test:1234/ws'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(MockWebSocket.instances).toHaveLength(1);

    // First close → reconnect after 1s
    act(() => {
      MockWebSocket.instances[0].simulateClose();
    });

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    expect(MockWebSocket.instances).toHaveLength(2);

    // Second close → reconnect after 2s
    act(() => {
      MockWebSocket.instances[1].simulateClose();
    });

    await act(async () => {
      vi.advanceTimersByTime(1_999);
    });

    expect(MockWebSocket.instances).toHaveLength(2); // not yet

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(MockWebSocket.instances).toHaveLength(3);
  });

  it('closes WebSocket and clears timers on unmount', async () => {
    const { unmount } = renderHook(() => useWebSocket('ws://test:1234/ws'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    const ws = MockWebSocket.instances[0];
    expect(ws.readyState).toBe(MockWebSocket.OPEN);

    unmount();

    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });

  it('sends subscribe message via subscribe helper', async () => {
    const { result } = renderHook(() => useWebSocket('ws://test:1234/ws'));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    act(() => {
      result.current.subscribe(['activity:new', 'task:updated']);
    });

    const ws = MockWebSocket.instances[0];
    expect(ws.sent).toContainEqual(
      JSON.stringify({
        action: 'subscribe',
        events: ['activity:new', 'task:updated'],
      }),
    );
  });
});
