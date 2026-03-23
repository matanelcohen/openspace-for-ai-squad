/**
 * Tests for WebSocketManager — P3-1
 *
 * Tests connection lifecycle, broadcasting, subscriptions, heartbeat,
 * and client message handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

import { WebSocketManager } from './manager.js';
import type { WsEnvelope, WsEventType } from './types.js';

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
    this.sentMessages.push(data);
  }

  close(code?: number, reason?: string) {
    this.closeCode = code;
    this.closeReason = reason;
    this.closed = true;
    this.readyState = 3; // CLOSED
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

  // Simulate receiving a message from client
  simulateMessage(data: string | object) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    this.emit('message', Buffer.from(raw));
  }
}

// ── Tests ─────────────────────────────────────────────────────────

describe('WebSocketManager', () => {
  let manager: WebSocketManager;

  beforeEach(() => {
    manager = new WebSocketManager({ heartbeatIntervalMs: 60_000 });
  });

  afterEach(async () => {
    await manager.shutdown();
  });

  describe('connection lifecycle', () => {
    it('should add a client and assign an ID', () => {
      const ws = new MockWebSocket();
      const id = manager.addClient(ws as unknown as import('ws').WebSocket);

      expect(id).toBeTypeOf('string');
      expect(id.length).toBeGreaterThan(0);
      expect(manager.clientCount).toBe(1);
    });

    it('should send a welcome message on connect', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);

      expect(ws.sentMessages).toHaveLength(1);
      const welcome = JSON.parse(ws.sentMessages[0]!);
      expect(welcome.type).toBe('agent:status');
      expect(welcome.payload.connected).toBe(true);
      expect(welcome.payload.clientId).toBeTypeOf('string');
    });

    it('should remove client on close', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);
      expect(manager.clientCount).toBe(1);

      ws.emit('close');
      expect(manager.clientCount).toBe(0);
    });

    it('should remove client on error', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);
      expect(manager.clientCount).toBe(1);

      ws.emit('error', new Error('test'));
      expect(manager.clientCount).toBe(0);
    });

    it('should handle multiple clients', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      const ws3 = new MockWebSocket();

      manager.addClient(ws1 as unknown as import('ws').WebSocket);
      manager.addClient(ws2 as unknown as import('ws').WebSocket);
      manager.addClient(ws3 as unknown as import('ws').WebSocket);

      expect(manager.clientCount).toBe(3);
      expect(manager.getClientIds()).toHaveLength(3);
    });

    it('should remove a client by ID', () => {
      const ws = new MockWebSocket();
      const id = manager.addClient(ws as unknown as import('ws').WebSocket);
      expect(manager.clientCount).toBe(1);

      manager.removeClient(id);
      expect(manager.clientCount).toBe(0);
      expect(ws.closed).toBe(true);
    });
  });

  describe('broadcasting', () => {
    it('should broadcast to all connected clients', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      manager.addClient(ws1 as unknown as import('ws').WebSocket);
      manager.addClient(ws2 as unknown as import('ws').WebSocket);

      const envelope: WsEnvelope = {
        type: 'task:updated',
        payload: { id: 'task-1' },
        timestamp: new Date().toISOString(),
      };

      manager.broadcast(envelope);

      // Both should have welcome (1) + broadcast (1) = 2 messages
      expect(ws1.sentMessages).toHaveLength(2);
      expect(ws2.sentMessages).toHaveLength(2);

      const msg1 = JSON.parse(ws1.sentMessages[1]!);
      expect(msg1.type).toBe('task:updated');
      expect(msg1.payload.id).toBe('task-1');
    });

    it('should not send to closed connections', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);

      ws.readyState = 3; // CLOSED

      const envelope: WsEnvelope = {
        type: 'task:created',
        payload: { id: 'task-2' },
        timestamp: new Date().toISOString(),
      };

      manager.broadcast(envelope);

      // Only the welcome message
      expect(ws.sentMessages).toHaveLength(1);
    });

    it('should handle send errors gracefully', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);

      ws.send = () => {
        throw new Error('Connection reset');
      };

      const envelope: WsEnvelope = {
        type: 'task:created',
        payload: {},
        timestamp: new Date().toISOString(),
      };

      // Should not throw
      expect(() => manager.broadcast(envelope)).not.toThrow();
    });
  });

  describe('subscriptions', () => {
    it('should deliver all events when no subscription filter', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);

      manager.broadcast({
        type: 'task:updated',
        payload: {},
        timestamp: new Date().toISOString(),
      });
      manager.broadcast({
        type: 'chat:message',
        payload: {},
        timestamp: new Date().toISOString(),
      });

      // welcome + 2 broadcasts
      expect(ws.sentMessages).toHaveLength(3);
    });

    it('should filter events based on subscriptions', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);

      // Subscribe only to task events
      ws.simulateMessage({ action: 'subscribe', events: ['task:updated', 'task:created'] });

      manager.broadcast({
        type: 'task:updated',
        payload: {},
        timestamp: new Date().toISOString(),
      });
      manager.broadcast({
        type: 'chat:message',
        payload: {},
        timestamp: new Date().toISOString(),
      });

      // welcome + 1 matching broadcast (task:updated), chat:message filtered out
      expect(ws.sentMessages).toHaveLength(2);
      const lastMsg = JSON.parse(ws.sentMessages[1]!);
      expect(lastMsg.type).toBe('task:updated');
    });

    it('should handle unsubscribe', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);

      // Subscribe then unsubscribe
      ws.simulateMessage({ action: 'subscribe', events: ['task:updated'] });
      ws.simulateMessage({ action: 'unsubscribe', events: ['task:updated'] });

      manager.broadcast({
        type: 'task:updated',
        payload: {},
        timestamp: new Date().toISOString(),
      });

      // welcome + broadcast (subscriptions empty = everything passes)
      expect(ws.sentMessages).toHaveLength(2);
    });

    it('should ignore invalid event types in subscription', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);

      ws.simulateMessage({ action: 'subscribe', events: ['invalid:type' as WsEventType] });

      // Should not crash
      expect(manager.clientCount).toBe(1);
    });
  });

  describe('heartbeat', () => {
    it('should start and stop heartbeat', () => {
      vi.useFakeTimers();

      manager = new WebSocketManager({ heartbeatIntervalMs: 100, pongTimeoutMs: 50 });
      manager.startHeartbeat();

      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);

      // Advance past one heartbeat interval
      vi.advanceTimersByTime(100);
      expect(ws.pinged).toBe(true);

      manager.stopHeartbeat();
      vi.useRealTimers();
    });

    it('should terminate unresponsive clients', () => {
      vi.useFakeTimers();

      manager = new WebSocketManager({ heartbeatIntervalMs: 100 });
      manager.startHeartbeat();

      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);

      // First heartbeat: marks as not-alive, pings
      vi.advanceTimersByTime(100);
      expect(manager.clientCount).toBe(1);

      // Second heartbeat: still not-alive → terminate
      vi.advanceTimersByTime(100);
      expect(manager.clientCount).toBe(0);
      expect(ws.terminated).toBe(true);

      manager.stopHeartbeat();
      vi.useRealTimers();
    });

    it('should keep alive clients that respond with pong', () => {
      vi.useFakeTimers();

      manager = new WebSocketManager({ heartbeatIntervalMs: 100 });
      manager.startHeartbeat();

      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);

      // First heartbeat
      vi.advanceTimersByTime(100);

      // Client sends pong
      ws.simulateMessage({ action: 'pong' });

      // Second heartbeat: should still be alive
      vi.advanceTimersByTime(100);
      expect(manager.clientCount).toBe(1);

      manager.stopHeartbeat();
      vi.useRealTimers();
    });
  });

  describe('shutdown', () => {
    it('should close all connections on shutdown', async () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();

      manager.addClient(ws1 as unknown as import('ws').WebSocket);
      manager.addClient(ws2 as unknown as import('ws').WebSocket);

      await manager.shutdown();

      expect(manager.clientCount).toBe(0);
      expect(ws1.closed).toBe(true);
      expect(ws2.closed).toBe(true);
    });
  });

  describe('message handling', () => {
    it('should ignore unparseable messages', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as import('ws').WebSocket);

      // Send invalid JSON
      ws.simulateMessage('not json at all {{{');

      // Should not crash
      expect(manager.clientCount).toBe(1);
    });
  });
});
