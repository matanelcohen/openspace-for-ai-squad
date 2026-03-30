/**
 * Tests for WebSocketManager — P3-1
 *
 * Tests connection lifecycle, broadcasting, subscriptions, heartbeat,
 * and client message handling.
 */

import { EventEmitter } from 'node:events';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';

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
      const id = manager.addClient(ws as unknown as WebSocket);

      expect(id).toBeTypeOf('string');
      expect(id.length).toBeGreaterThan(0);
      expect(manager.clientCount).toBe(1);
    });

    it('should send a welcome message on connect', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      expect(ws.sentMessages).toHaveLength(1);
      const welcome = JSON.parse(ws.sentMessages[0]!);
      expect(welcome.type).toBe('agent:status');
      expect(welcome.payload.connected).toBe(true);
      expect(welcome.payload.clientId).toBeTypeOf('string');
    });

    it('should remove client on close', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);
      expect(manager.clientCount).toBe(1);

      ws.emit('close');
      expect(manager.clientCount).toBe(0);
    });

    it('should remove client on error', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);
      expect(manager.clientCount).toBe(1);

      ws.emit('error', new Error('test'));
      expect(manager.clientCount).toBe(0);
    });

    it('should handle multiple clients', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      const ws3 = new MockWebSocket();

      manager.addClient(ws1 as unknown as WebSocket);
      manager.addClient(ws2 as unknown as WebSocket);
      manager.addClient(ws3 as unknown as WebSocket);

      expect(manager.clientCount).toBe(3);
      expect(manager.getClientIds()).toHaveLength(3);
    });

    it('should remove a client by ID', () => {
      const ws = new MockWebSocket();
      const id = manager.addClient(ws as unknown as WebSocket);
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

      manager.addClient(ws1 as unknown as WebSocket);
      manager.addClient(ws2 as unknown as WebSocket);

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
      manager.addClient(ws as unknown as WebSocket);

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
      manager.addClient(ws as unknown as WebSocket);

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
      manager.addClient(ws as unknown as WebSocket);

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
      manager.addClient(ws as unknown as WebSocket);

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
      manager.addClient(ws as unknown as WebSocket);

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
      manager.addClient(ws as unknown as WebSocket);

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
      manager.addClient(ws as unknown as WebSocket);

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
      manager.addClient(ws as unknown as WebSocket);

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
      manager.addClient(ws as unknown as WebSocket);

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

      manager.addClient(ws1 as unknown as WebSocket);
      manager.addClient(ws2 as unknown as WebSocket);

      await manager.shutdown();

      expect(manager.clientCount).toBe(0);
      expect(ws1.closed).toBe(true);
      expect(ws2.closed).toBe(true);
    });
  });

  describe('message handling', () => {
    it('should send INVALID_JSON error for unparseable messages', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage('not json at all {{{');

      // Client should still be connected
      expect(manager.clientCount).toBe(1);

      // Should have welcome (1) + error envelope (1) = 2 messages
      expect(ws.sentMessages).toHaveLength(2);
      const errorMsg = JSON.parse(ws.sentMessages[1]!);
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.code).toBe('INVALID_JSON');
      expect(errorMsg.message).toContain('Message parse failed');
      expect(errorMsg.timestamp).toBeTypeOf('string');
    });

    it('should send INVALID_FORMAT error for non-object messages', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      // Array
      ws.simulateMessage([1, 2, 3]);
      expect(ws.sentMessages).toHaveLength(2);
      const arrError = JSON.parse(ws.sentMessages[1]!);
      expect(arrError.type).toBe('error');
      expect(arrError.code).toBe('INVALID_FORMAT');
      expect(arrError.message).toBe('Message must be a JSON object');

      // String primitive
      ws.simulateMessage('"just a string"');
      expect(ws.sentMessages).toHaveLength(3);
      const strError = JSON.parse(ws.sentMessages[2]!);
      expect(strError.code).toBe('INVALID_FORMAT');

      // Number
      ws.simulateMessage('42');
      expect(ws.sentMessages).toHaveLength(4);
      const numError = JSON.parse(ws.sentMessages[3]!);
      expect(numError.code).toBe('INVALID_FORMAT');

      // null
      ws.simulateMessage('null');
      expect(ws.sentMessages).toHaveLength(5);
      const nullError = JSON.parse(ws.sentMessages[4]!);
      expect(nullError.code).toBe('INVALID_FORMAT');
    });

    it('should send MISSING_ACTION error for objects without action field', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage({ foo: 'bar' });
      expect(ws.sentMessages).toHaveLength(2);
      const errorMsg = JSON.parse(ws.sentMessages[1]!);
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.code).toBe('MISSING_ACTION');
      expect(errorMsg.message).toBe('Message must include an "action" string field');
    });

    it('should send MISSING_ACTION error when action is not a string', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage({ action: 123 });
      expect(ws.sentMessages).toHaveLength(2);
      const errorMsg = JSON.parse(ws.sentMessages[1]!);
      expect(errorMsg.code).toBe('MISSING_ACTION');
    });

    it('should send UNKNOWN_ACTION error for unrecognized actions', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage({ action: 'nonexistent:action' });
      expect(ws.sentMessages).toHaveLength(2);
      const errorMsg = JSON.parse(ws.sentMessages[1]!);
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.code).toBe('UNKNOWN_ACTION');
      expect(errorMsg.message).toContain('nonexistent:action');
    });

    it('should not send error for valid subscribe messages', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage({ action: 'subscribe', events: ['task:updated'] });

      // Only the welcome message — no error
      expect(ws.sentMessages).toHaveLength(1);
    });

    it('should not send error envelope to closed connections', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      // Close the connection before sending bad message
      ws.readyState = 3; // CLOSED

      ws.simulateMessage('invalid json {{{');

      // Only the welcome message (sent before close)
      expect(ws.sentMessages).toHaveLength(1);
    });

    it('should handle send error during error envelope delivery', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      // Make send throw after the welcome message
      const originalSend = ws.send.bind(ws);
      let callCount = 0;
      ws.send = (data: string) => {
        callCount++;
        if (callCount > 1) throw new Error('Connection reset');
        originalSend(data);
      };

      // Should not throw even though send fails
      expect(() => {
        ws.simulateMessage('bad json');
      }).not.toThrow();

      expect(manager.clientCount).toBe(1);
    });

    it('should include ISO timestamp in error envelopes', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage('bad json!!!');

      const errorMsg = JSON.parse(ws.sentMessages[1]!);
      // Verify ISO 8601 format
      expect(new Date(errorMsg.timestamp).toISOString()).toBe(errorMsg.timestamp);
    });
  });
});
