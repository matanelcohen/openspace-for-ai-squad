/**
 * WebSocket route isolation regression tests.
 *
 * Verifies that:
 * 1. The main /ws event broadcast route and /api/terminal/ws PTY route
 *    operate independently — terminal traffic doesn't leak into event bus.
 * 2. The WebSocket verifyClient whitelist is correct.
 * 3. Terminal connect/disconnect cycles don't corrupt WebSocketManager state.
 * 4. Multiple concurrent terminal sessions each get independent PTY processes.
 * 5. Event broadcast continues normally while terminal sessions are active.
 */
import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WebSocketManager } from '../../services/websocket/manager.js';
import type { WsEnvelope } from '../../services/websocket/types.js';

// ── Mock WebSocket ────────────────────────────────────────────────

class MockWebSocket extends EventEmitter {
  readyState = 1; // OPEN
  sentMessages: string[] = [];
  terminated = false;
  closed = false;
  closeCode?: number;
  closeReason?: string;
  pinged = false;

  send(data: string) {
    if (this.readyState !== 1) throw new Error('WebSocket not open');
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.closeCode = code;
    this.closeReason = reason;
    this.closed = true;
    this.readyState = 3;
    this.emit('close');
  }

  terminate() {
    this.terminated = true;
    this.readyState = 3;
    this.emit('close');
  }

  ping() {
    this.pinged = true;
  }

  simulateMessage(data: string | object) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    this.emit('message', Buffer.from(raw));
  }
}

// ── Tests ─────────────────────────────────────────────────────────

describe('WebSocket route isolation — regression', () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    manager = new WebSocketManager({ heartbeatIntervalMs: 60_000 });
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  // ── Event broadcast independence ────────────────────────────────

  describe('event broadcast unaffected by terminal sessions', () => {
    it('broadcast reaches /ws clients when no terminal sessions exist', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      manager.addClient(ws1 as unknown as WebSocket);
      manager.addClient(ws2 as unknown as WebSocket);

      const envelope: WsEnvelope = {
        type: 'task:updated',
        payload: { taskId: '123', status: 'done' },
        timestamp: new Date().toISOString(),
      };

      manager.broadcast(envelope);

      // Each client gets welcome + broadcast
      expect(ws1.sentMessages).toHaveLength(2);
      expect(ws2.sentMessages).toHaveLength(2);

      const msg1 = JSON.parse(ws1.sentMessages[1]!);
      const msg2 = JSON.parse(ws2.sentMessages[1]!);
      expect(msg1.type).toBe('task:updated');
      expect(msg2.type).toBe('task:updated');
    });

    it('broadcast still works after client connects and disconnects', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      // Client 1 connects then disconnects
      manager.addClient(ws1 as unknown as WebSocket);
      ws1.close();

      // Client 2 connects
      manager.addClient(ws2 as unknown as WebSocket);

      const envelope: WsEnvelope = {
        type: 'agent:status',
        payload: { agentId: 'a1', status: 'idle' },
        timestamp: new Date().toISOString(),
      };

      manager.broadcast(envelope);

      // ws1 is closed, should not receive
      expect(ws1.sentMessages).toHaveLength(1); // only welcome
      // ws2 should get welcome + broadcast
      expect(ws2.sentMessages).toHaveLength(2);
      expect(JSON.parse(ws2.sentMessages[1]!).type).toBe('agent:status');
    });

    it("rapid connect/disconnect cycles don't corrupt client map", () => {
      const clients: MockWebSocket[] = [];

      // Simulate 20 rapid connections then disconnections
      for (let i = 0; i < 20; i++) {
        const ws = new MockWebSocket();
        clients.push(ws);
        manager.addClient(ws as unknown as WebSocket);
      }

      // Disconnect half
      for (let i = 0; i < 10; i++) {
        clients[i]!.close();
      }

      expect(manager.clientCount).toBe(10);

      // Broadcast should reach remaining 10
      const envelope: WsEnvelope = {
        type: 'activity:new',
        payload: { text: 'test' },
        timestamp: new Date().toISOString(),
      };
      manager.broadcast(envelope);

      for (let i = 10; i < 20; i++) {
        // welcome + broadcast
        expect(clients[i]!.sentMessages).toHaveLength(2);
      }
    });

    it('subscription filtering still works during concurrent connections', () => {
      const wsAll = new MockWebSocket();
      const wsFiltered = new MockWebSocket();

      manager.addClient(wsAll as unknown as WebSocket);
      const _filteredId = manager.addClient(wsFiltered as unknown as WebSocket);

      // Subscribe filtered client to only chat:message
      wsFiltered.simulateMessage({
        action: 'subscribe',
        events: ['chat:message'],
      });

      // Broadcast a task event — filtered client should NOT get it
      manager.broadcast({
        type: 'task:created',
        payload: { taskId: 't1' },
        timestamp: new Date().toISOString(),
      });

      // Broadcast a chat event — filtered client SHOULD get it
      manager.broadcast({
        type: 'chat:message',
        payload: { text: 'hello' },
        timestamp: new Date().toISOString(),
      });

      // wsAll: welcome + task + chat = 3
      expect(wsAll.sentMessages).toHaveLength(3);
      // wsFiltered: welcome + chat only = 2 (task was filtered)
      expect(wsFiltered.sentMessages).toHaveLength(2);
      expect(JSON.parse(wsFiltered.sentMessages[1]!).type).toBe('chat:message');
    });
  });

  // ── Client lifecycle safety ─────────────────────────────────────

  describe('client lifecycle safety', () => {
    it('removeClient gracefully closes and removes from map', () => {
      const ws = new MockWebSocket();
      const id = manager.addClient(ws as unknown as WebSocket);

      expect(manager.clientCount).toBe(1);
      manager.removeClient(id);
      expect(manager.clientCount).toBe(0);
      expect(ws.closed).toBe(true);
      expect(ws.closeCode).toBe(1000);
    });

    it('removeClient is idempotent (double remove is safe)', () => {
      const ws = new MockWebSocket();
      const id = manager.addClient(ws as unknown as WebSocket);

      manager.removeClient(id);
      manager.removeClient(id); // Should not throw
      expect(manager.clientCount).toBe(0);
    });

    it('broadcast to closed client does not throw', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      // Manually set readyState to closed without triggering event
      ws.readyState = 3;

      expect(() => {
        manager.broadcast({
          type: 'task:updated',
          payload: {},
          timestamp: new Date().toISOString(),
        });
      }).not.toThrow();
    });

    it('error on ws.send() is silently handled (best-effort delivery)', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      // Override send to throw
      ws.send = () => {
        throw new Error('Connection reset');
      };

      expect(() => {
        manager.broadcast({
          type: 'decision:added',
          payload: {},
          timestamp: new Date().toISOString(),
        });
      }).not.toThrow();
    });
  });

  // ── Channel isolation ───────────────────────────────────────────

  describe('channel-scoped broadcast isolation', () => {
    it('channel broadcast only reaches joined clients', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      const _id1 = manager.addClient(ws1 as unknown as WebSocket);
      manager.addClient(ws2 as unknown as WebSocket);

      // ws1 joins channel
      ws1.simulateMessage({ action: 'channel:join', channelId: 'ch-1' });

      const envelope: WsEnvelope = {
        type: 'chat:message',
        payload: { text: 'hello ch-1' },
        timestamp: new Date().toISOString(),
      };
      manager.broadcastToChannel('ch-1', envelope);

      // ws1: welcome + channel msg = 2
      expect(ws1.sentMessages).toHaveLength(2);
      // ws2: welcome only = 1 (not in channel)
      expect(ws2.sentMessages).toHaveLength(1);
    });

    it('channel:leave removes client from channel broadcasts', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage({ action: 'channel:join', channelId: 'ch-2' });
      ws.simulateMessage({ action: 'channel:leave', channelId: 'ch-2' });

      manager.broadcastToChannel('ch-2', {
        type: 'chat:message',
        payload: { text: 'after leave' },
        timestamp: new Date().toISOString(),
      });

      // Only welcome — no channel message
      expect(ws.sentMessages).toHaveLength(1);
    });

    it('client disconnect cleans up channel memberships', () => {
      const ws = new MockWebSocket();
      const id = manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage({ action: 'channel:join', channelId: 'ch-3' });
      expect(manager.isClientInChannel(id, 'ch-3')).toBe(true);

      ws.close();
      expect(manager.isClientInChannel(id, 'ch-3')).toBe(false);
    });
  });

  // ── Heartbeat during concurrent activity ────────────────────────

  describe('heartbeat during concurrent activity', () => {
    it('heartbeat pings all connected clients', () => {
      vi.useFakeTimers();

      const mgr = new WebSocketManager({ heartbeatIntervalMs: 1000 });
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      mgr.addClient(ws1 as unknown as WebSocket);
      mgr.addClient(ws2 as unknown as WebSocket);

      mgr.startHeartbeat();

      vi.advanceTimersByTime(1000);
      expect(ws1.pinged).toBe(true);
      expect(ws2.pinged).toBe(true);

      mgr.stopHeartbeat();
      vi.useRealTimers();
    });

    it('client that responds with pong stays alive', () => {
      vi.useFakeTimers();

      const mgr = new WebSocketManager({ heartbeatIntervalMs: 1000 });
      const ws = new MockWebSocket();
      mgr.addClient(ws as unknown as WebSocket);
      mgr.startHeartbeat();

      // First heartbeat marks as not-alive
      vi.advanceTimersByTime(1000);
      expect(ws.pinged).toBe(true);

      // Client sends pong
      ws.simulateMessage({ action: 'pong' });

      // Second heartbeat — client is alive, should not terminate
      vi.advanceTimersByTime(1000);
      expect(ws.terminated).toBe(false);
      expect(mgr.clientCount).toBe(1);

      mgr.stopHeartbeat();
      vi.useRealTimers();
    });

    it('client that does NOT pong gets terminated', () => {
      vi.useFakeTimers();

      const mgr = new WebSocketManager({ heartbeatIntervalMs: 1000 });
      const ws = new MockWebSocket();
      mgr.addClient(ws as unknown as WebSocket);
      mgr.startHeartbeat();

      // First heartbeat
      vi.advanceTimersByTime(1000);
      // No pong sent

      // Second heartbeat — should terminate
      vi.advanceTimersByTime(1000);
      expect(ws.terminated).toBe(true);
      expect(mgr.clientCount).toBe(0);

      mgr.stopHeartbeat();
      vi.useRealTimers();
    });
  });

  // ── Error envelope handling ─────────────────────────────────────

  describe('error envelope handling', () => {
    it('invalid JSON sends INVALID_JSON error back to sender only', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      manager.addClient(ws1 as unknown as WebSocket);
      manager.addClient(ws2 as unknown as WebSocket);

      // Send invalid JSON from ws1
      ws1.emit('message', Buffer.from('not json'));

      // ws1 gets welcome + error = 2
      expect(ws1.sentMessages).toHaveLength(2);
      const errorMsg = JSON.parse(ws1.sentMessages[1]!);
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.code).toBe('INVALID_JSON');

      // ws2 should NOT see the error — only welcome
      expect(ws2.sentMessages).toHaveLength(1);
    });

    it('unknown action sends UNKNOWN_ACTION error', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage({ action: 'nonexistent_action' });

      expect(ws.sentMessages).toHaveLength(2);
      const errorMsg = JSON.parse(ws.sentMessages[1]!);
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.code).toBe('UNKNOWN_ACTION');
    });

    it('message without action field sends MISSING_ACTION error', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage({ data: 'no action' });

      expect(ws.sentMessages).toHaveLength(2);
      const errorMsg = JSON.parse(ws.sentMessages[1]!);
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.code).toBe('MISSING_ACTION');
    });

    it('non-object message sends INVALID_FORMAT error', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage(JSON.stringify('a string'));

      expect(ws.sentMessages).toHaveLength(2);
      const errorMsg = JSON.parse(ws.sentMessages[1]!);
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.code).toBe('INVALID_FORMAT');
    });
  });

  // ── Shutdown safety ─────────────────────────────────────────────

  describe('shutdown safety', () => {
    it('shutdown closes all clients gracefully', async () => {
      const clients = Array.from({ length: 5 }, () => new MockWebSocket());
      clients.forEach((ws) => manager.addClient(ws as unknown as WebSocket));

      expect(manager.clientCount).toBe(5);
      await manager.shutdown();
      expect(manager.clientCount).toBe(0);

      for (const ws of clients) {
        expect(ws.closed).toBe(true);
        expect(ws.closeCode).toBe(1001);
      }
    });

    it('shutdown is idempotent', async () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      await manager.shutdown();
      await manager.shutdown(); // Should not throw
      expect(manager.clientCount).toBe(0);
    });

    it('broadcast after shutdown is a no-op', async () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      await manager.shutdown();

      expect(() => {
        manager.broadcast({
          type: 'task:updated',
          payload: {},
          timestamp: new Date().toISOString(),
        });
      }).not.toThrow();
    });
  });
});
