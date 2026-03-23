/**
 * P3-9 — Real-time integration tests
 *
 * End-to-end tests for the WebSocket pipeline:
 *   - Connection lifecycle and reconnection behavior
 *   - Event delivery with subscription filtering
 *   - Chat message round-trip (send → persist → broadcast)
 *   - Activity/notification badge updates via file watcher
 *   - FileWatcher → WebSocket event latency (<3s)
 *   - Concurrent connections
 *   - Edge cases: rapid status changes, network disconnection
 */

import { EventEmitter } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { ActivityEvent } from '@openspace/shared';
import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WebSocket } from 'ws';

import { ActivityFeed } from '../services/activity/index.js';
import { ChatService } from '../services/chat/index.js';
import { initializeSchema } from '../services/db/schema.js';
import type { FileWatcher, FileWatcherEvent } from '../services/file-watcher/index.js';
import { FileWatcherBridge } from '../services/websocket/bridge.js';
import { WebSocketManager } from '../services/websocket/manager.js';
import type { WsEnvelope, WsEventType } from '../services/websocket/types.js';

// ── Mock WebSocket ────────────────────────────────────────────────

class MockWebSocket extends EventEmitter {
  readyState = 1; // OPEN
  sentMessages: string[] = [];
  terminated = false;
  closed = false;

  send(data: string) {
    this.sentMessages.push(data);
  }

  close(_code?: number) {
    this.closed = true;
    this.readyState = 3;
    this.emit('close');
  }

  terminate() {
    this.terminated = true;
    this.readyState = 3;
    this.emit('close');
  }

  ping() {}

  simulateMessage(data: string | object) {
    const raw = typeof data === 'string' ? data : JSON.stringify(data);
    this.emit('message', Buffer.from(raw));
  }

  /** Parse sent messages (skip welcome at index 0) */
  getEvents(): WsEnvelope[] {
    return this.sentMessages.map((m) => JSON.parse(m));
  }
}

// ── Mock FileWatcher ──────────────────────────────────────────────

class MockFileWatcher extends EventEmitter {
  triggerChange(event: FileWatcherEvent) {
    this.emit('change', event);
  }
}

// ── Helpers ───────────────────────────────────────────────────────

function createClient(manager: WebSocketManager): { ws: MockWebSocket; id: string } {
  const ws = new MockWebSocket();
  const id = manager.addClient(ws as unknown as WebSocket);
  ws.sentMessages = []; // clear welcome
  return { ws, id };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('P3-9: Real-time integration tests', () => {
  // ── WebSocket connection & reconnection ──────────────────────────

  describe('WebSocket connection and reconnection', () => {
    let manager: WebSocketManager;

    beforeEach(() => {
      manager = new WebSocketManager({ heartbeatIntervalMs: 60_000 });
    });

    afterEach(async () => {
      await manager.shutdown();
    });

    it('assigns unique IDs to each connection', () => {
      const id1 = manager.addClient(new MockWebSocket() as unknown as WebSocket);
      const id2 = manager.addClient(new MockWebSocket() as unknown as WebSocket);
      const id3 = manager.addClient(new MockWebSocket() as unknown as WebSocket);

      expect(new Set([id1, id2, id3]).size).toBe(3);
      expect(manager.clientCount).toBe(3);
    });

    it('sends welcome message with client ID on connect', () => {
      const ws = new MockWebSocket();
      const id = manager.addClient(ws as unknown as WebSocket);

      const welcome = JSON.parse(ws.sentMessages[0]!);
      expect(welcome.type).toBe('agent:status');
      expect(welcome.payload.connected).toBe(true);
      expect(welcome.payload.clientId).toBe(id);
    });

    it('cleans up on close event (simulates disconnect)', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);
      expect(manager.clientCount).toBe(1);

      ws.emit('close');
      expect(manager.clientCount).toBe(0);
    });

    it('cleans up on error event (simulates network failure)', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);
      ws.emit('error', new Error('ECONNRESET'));
      expect(manager.clientCount).toBe(0);
    });

    it('handles reconnection: new client after old one disconnects', () => {
      const ws1 = new MockWebSocket();
      const id1 = manager.addClient(ws1 as unknown as WebSocket);
      ws1.emit('close');
      expect(manager.clientCount).toBe(0);

      // "Reconnect"
      const ws2 = new MockWebSocket();
      const id2 = manager.addClient(ws2 as unknown as WebSocket);
      expect(manager.clientCount).toBe(1);
      expect(id2).not.toBe(id1);
    });

    it('terminates unresponsive clients via heartbeat', () => {
      vi.useFakeTimers();

      const mgr = new WebSocketManager({ heartbeatIntervalMs: 100 });
      mgr.startHeartbeat();

      const ws = new MockWebSocket();
      mgr.addClient(ws as unknown as WebSocket);

      // 1st heartbeat: sets alive=false
      vi.advanceTimersByTime(100);
      expect(mgr.clientCount).toBe(1);

      // 2nd heartbeat: still not alive → terminate
      vi.advanceTimersByTime(100);
      expect(mgr.clientCount).toBe(0);
      expect(ws.terminated).toBe(true);

      mgr.stopHeartbeat();
      vi.useRealTimers();
    });

    it('keeps clients alive when they respond to pongs', () => {
      vi.useFakeTimers();

      const mgr = new WebSocketManager({ heartbeatIntervalMs: 100 });
      mgr.startHeartbeat();

      const ws = new MockWebSocket();
      mgr.addClient(ws as unknown as WebSocket);

      // Survive 5 heartbeat cycles by responding with pong each time
      for (let i = 0; i < 5; i++) {
        vi.advanceTimersByTime(100);
        ws.simulateMessage({ action: 'pong' });
      }

      expect(mgr.clientCount).toBe(1);

      mgr.stopHeartbeat();
      vi.useRealTimers();
    });
  });

  // ── Event delivery (mock WebSocket server) ──────────────────────

  describe('Event delivery with subscriptions', () => {
    let manager: WebSocketManager;

    beforeEach(() => {
      manager = new WebSocketManager({ heartbeatIntervalMs: 60_000 });
    });

    afterEach(async () => {
      await manager.shutdown();
    });

    it('delivers all event types to unsubscribed clients', () => {
      const { ws } = createClient(manager);

      const eventTypes: WsEventType[] = [
        'agent:status',
        'task:updated',
        'task:created',
        'decision:added',
        'activity:new',
        'chat:message',
      ];

      for (const type of eventTypes) {
        manager.broadcast({ type, payload: { test: true }, timestamp: new Date().toISOString() });
      }

      expect(ws.sentMessages).toHaveLength(6);
    });

    it('filters events for subscribed clients', () => {
      const { ws } = createClient(manager);

      // Subscribe to only task events
      ws.simulateMessage({ action: 'subscribe', events: ['task:updated', 'task:created'] });

      manager.broadcast({ type: 'task:updated', payload: {}, timestamp: new Date().toISOString() });
      manager.broadcast({ type: 'chat:message', payload: {}, timestamp: new Date().toISOString() });
      manager.broadcast({ type: 'task:created', payload: {}, timestamp: new Date().toISOString() });
      manager.broadcast({ type: 'activity:new', payload: {}, timestamp: new Date().toISOString() });

      // Should only receive task:updated and task:created (2 messages)
      expect(ws.sentMessages).toHaveLength(2);
      const types = ws.getEvents().map((e) => e.type);
      expect(types).toEqual(['task:updated', 'task:created']);
    });

    it('unsubscribe resets to receive all events', () => {
      const { ws } = createClient(manager);

      ws.simulateMessage({ action: 'subscribe', events: ['task:updated'] });
      ws.simulateMessage({ action: 'unsubscribe', events: ['task:updated'] });

      // Subscriptions now empty → receives everything
      manager.broadcast({ type: 'chat:message', payload: {}, timestamp: new Date().toISOString() });
      expect(ws.sentMessages).toHaveLength(1);
    });

    it('broadcasts to multiple clients simultaneously', () => {
      const clients = Array.from({ length: 5 }, () => createClient(manager));

      manager.broadcast({ type: 'task:updated', payload: { id: 'x' }, timestamp: new Date().toISOString() });

      for (const { ws } of clients) {
        expect(ws.sentMessages).toHaveLength(1);
        expect(ws.getEvents()[0]!.type).toBe('task:updated');
      }
    });

    it('does not send to disconnected clients', () => {
      const { ws } = createClient(manager);
      ws.readyState = 3; // Simulate closed

      manager.broadcast({ type: 'task:updated', payload: {}, timestamp: new Date().toISOString() });
      expect(ws.sentMessages).toHaveLength(0);
    });

    it('handles mixed subscription states across clients', () => {
      const { ws: wsAll } = createClient(manager);
      const { ws: wsTasksOnly } = createClient(manager);
      const { ws: wsChatOnly } = createClient(manager);

      wsTasksOnly.simulateMessage({ action: 'subscribe', events: ['task:updated'] });
      wsChatOnly.simulateMessage({ action: 'subscribe', events: ['chat:message'] });

      manager.broadcast({ type: 'task:updated', payload: {}, timestamp: new Date().toISOString() });
      manager.broadcast({ type: 'chat:message', payload: {}, timestamp: new Date().toISOString() });

      expect(wsAll.sentMessages).toHaveLength(2); // receives both
      expect(wsTasksOnly.sentMessages).toHaveLength(1); // only task
      expect(wsChatOnly.sentMessages).toHaveLength(1); // only chat
    });

    it('handles rapid broadcast bursts', () => {
      const { ws } = createClient(manager);

      // Send 100 events rapidly
      for (let i = 0; i < 100; i++) {
        manager.broadcast({
          type: 'task:updated',
          payload: { i },
          timestamp: new Date().toISOString(),
        });
      }

      expect(ws.sentMessages).toHaveLength(100);
    });
  });

  // ── Chat message round-trip ─────────────────────────────────────

  describe('Chat message round-trip', () => {
    let manager: WebSocketManager;
    let chatService: ChatService;
    let db: Database.Database;
    let tmpDir: string;

    beforeEach(async () => {
      manager = new WebSocketManager({ heartbeatIntervalMs: 60_000 });
      db = new BetterSqlite3(':memory:');
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
      initializeSchema(db);
      tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'rt-chat-'));

      chatService = new ChatService({ db, sessionsDir: tmpDir });
      chatService.setWebSocketManager(manager);
    });

    afterEach(async () => {
      db.close();
      await manager.shutdown();
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    });

    it('sends a message and broadcasts to connected client', async () => {
      const { ws } = createClient(manager);

      const msg = await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: 'Hello from integration test!',
      });

      // Client should receive the chat:message event
      expect(ws.sentMessages.length).toBeGreaterThanOrEqual(1);
      const chatEvent = ws.getEvents().find((e) => e.type === 'chat:message');
      expect(chatEvent).toBeDefined();
      expect((chatEvent!.payload as unknown as { id: string }).id).toBe(msg.id);
    });

    it('persists message to SQLite and markdown', async () => {
      const msg = await chatService.send({
        sender: 'user',
        recipient: 'fry',
        content: 'Persist me',
      });

      // SQLite
      const row = db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(msg.id) as Record<string, unknown>;
      expect(row).toBeTruthy();
      expect(row.content).toBe('Persist me');

      // Markdown
      const files = await fs.readdir(tmpDir);
      expect(files.length).toBeGreaterThanOrEqual(1);
      const content = await fs.readFile(path.join(tmpDir, files[0]!), 'utf-8');
      expect(content).toContain('Persist me');
    });

    it('team message triggers coordinator echo with 2 broadcasts', async () => {
      const { ws } = createClient(manager);

      await chatService.send({
        sender: 'user',
        recipient: 'team',
        content: 'Team round-trip test',
      });

      // Should have 2 broadcasts: original + coordinator echo
      const chatEvents = ws.getEvents().filter((e) => e.type === 'chat:message');
      expect(chatEvents).toHaveLength(2);
    });

    it('broadcasts to all connected clients on chat', async () => {
      const clients = Array.from({ length: 3 }, () => createClient(manager));

      await chatService.send({
        sender: 'user',
        recipient: 'bender',
        content: 'Multi-client test',
      });

      for (const { ws } of clients) {
        const chatEvents = ws.getEvents().filter((e) => e.type === 'chat:message');
        expect(chatEvents.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('chat messages are queryable immediately after send', async () => {
      await chatService.send({ sender: 'user', recipient: 'bender', content: 'msg-A' });
      await chatService.send({ sender: 'bender', recipient: 'user', content: 'msg-B' });
      await chatService.send({ sender: 'user', recipient: 'fry', content: 'msg-C' });

      const { messages, total } = chatService.getMessages({ limit: 10 });
      expect(total).toBe(3);
      expect(messages).toHaveLength(3);

      // Filter by agent
      const benderMsgs = chatService.getMessages({ agent: 'bender' });
      expect(benderMsgs.messages).toHaveLength(2); // sent to and from bender
    });
  });

  // ── Notification badge updates (Activity feed) ──────────────────

  describe('Notification badge updates via activity feed', () => {
    let manager: WebSocketManager;
    let feed: ActivityFeed;

    beforeEach(() => {
      manager = new WebSocketManager({ heartbeatIntervalMs: 60_000 });
      feed = new ActivityFeed(100);
      feed.setWebSocketManager(manager);
    });

    afterEach(async () => {
      await manager.shutdown();
    });

    it('pushes activity events to connected clients', () => {
      const { ws } = createClient(manager);

      feed.push({
        id: 'evt-1',
        type: 'started',
        agentId: 'bender',
        description: 'Started build',
        timestamp: new Date().toISOString(),
        relatedEntityId: null,
      });

      const activityEvents = ws.getEvents().filter((e) => e.type === 'activity:new');
      expect(activityEvents).toHaveLength(1);
      expect((activityEvents[0]!.payload as unknown as ActivityEvent).agentId).toBe('bender');
    });

    it('activity events accumulate for badge count queries', () => {
      // Push multiple events
      for (let i = 0; i < 5; i++) {
        feed.push({
          id: `evt-${i}`,
          type: i < 3 ? 'started' : 'completed',
          agentId: 'bender',
          description: `Event ${i}`,
          timestamp: new Date().toISOString(),
          relatedEntityId: null,
        });
      }

      const { events, total } = feed.getHistory(10);
      expect(total).toBe(5);
      expect(events).toHaveLength(5);
      // Newest first
      expect(events[0]!.id).toBe('evt-4');
    });

    it('file watcher changes generate activity events and WS broadcasts', () => {
      const watcher = new MockFileWatcher();
      feed.connectFileWatcher(watcher as unknown as FileWatcher);

      const { ws } = createClient(manager);

      watcher.emit('change', {
        type: 'task:created',
        path: 'tasks/new-task.md',
        timestamp: '2026-03-23T12:00:00Z',
      });

      // Activity feed should have 1 event
      expect(feed.size).toBe(1);

      // Client should receive activity:new
      const events = ws.getEvents().filter((e) => e.type === 'activity:new');
      expect(events).toHaveLength(1);

      feed.disconnectFileWatcher();
    });

    it('rapid activity pushes all broadcast to clients', () => {
      const { ws } = createClient(manager);

      for (let i = 0; i < 20; i++) {
        feed.push({
          id: `rapid-${i}`,
          type: 'started',
          agentId: 'fry',
          description: `Rapid event ${i}`,
          timestamp: new Date().toISOString(),
          relatedEntityId: null,
        });
      }

      const activityEvents = ws.getEvents().filter((e) => e.type === 'activity:new');
      expect(activityEvents).toHaveLength(20);
    });
  });

  // ── File changes → WebSocket events (<3s) ───────────────────────

  describe('File changes trigger WebSocket events within 3 seconds', () => {
    let manager: WebSocketManager;
    let bridge: FileWatcherBridge;
    let watcher: MockFileWatcher;

    beforeEach(() => {
      vi.useFakeTimers();
      manager = new WebSocketManager({ heartbeatIntervalMs: 60_000 });
      watcher = new MockFileWatcher();
      bridge = new FileWatcherBridge(watcher as unknown as FileWatcher, manager, {
        batchWindowMs: 200,
      });
    });

    afterEach(async () => {
      bridge.stop();
      await manager.shutdown();
      vi.useRealTimers();
    });

    it('delivers file change event within 200ms batch window', () => {
      bridge.start();
      const { ws } = createClient(manager);

      watcher.triggerChange({
        type: 'task:updated',
        path: 'tasks/my-task.md',
        timestamp: new Date().toISOString(),
      });

      // Not delivered yet (within batch window)
      expect(ws.sentMessages).toHaveLength(0);

      // Advance to flush
      vi.advanceTimersByTime(200);
      expect(ws.sentMessages).toHaveLength(1);
    });

    it('delivers within 3 seconds even with multiple rapid changes', () => {
      bridge.start();
      const { ws } = createClient(manager);

      // Simulate rapid file changes over 500ms
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(50);
        watcher.triggerChange({
          type: 'task:updated',
          path: `tasks/task-${i}.md`,
          timestamp: new Date().toISOString(),
        });
      }

      // Advance to 3 seconds total to ensure everything is flushed
      vi.advanceTimersByTime(3000);

      // All unique events should have been delivered
      expect(ws.sentMessages.length).toBeGreaterThan(0);
      expect(ws.sentMessages.length).toBeLessThanOrEqual(10);
    });

    it('deduplicates same file changes within batch window', () => {
      bridge.start();
      const { ws } = createClient(manager);

      // Same file changed 5 times rapidly
      for (let i = 0; i < 5; i++) {
        watcher.triggerChange({
          type: 'task:updated',
          path: 'tasks/same-task.md',
          timestamp: new Date().toISOString(),
        });
      }

      vi.advanceTimersByTime(200);

      // Should be deduplicated to 1
      expect(ws.sentMessages).toHaveLength(1);
    });

    it('maps file watcher events correctly', () => {
      bridge.start();
      const { ws } = createClient(manager);

      const mappings: Array<{ fileEvent: FileWatcherEvent['type']; wsEvent: WsEventType }> = [
        { fileEvent: 'agent:updated', wsEvent: 'agent:status' },
        { fileEvent: 'task:created', wsEvent: 'task:created' },
        { fileEvent: 'task:updated', wsEvent: 'task:updated' },
        { fileEvent: 'decision:added', wsEvent: 'decision:added' },
        { fileEvent: 'config:changed', wsEvent: 'agent:status' },
        { fileEvent: 'team:updated', wsEvent: 'agent:status' },
      ];

      for (const { fileEvent, wsEvent } of mappings) {
        ws.sentMessages = [];
        watcher.triggerChange({
          type: fileEvent,
          path: `${fileEvent}-test.md`,
          timestamp: new Date().toISOString(),
        });
        vi.advanceTimersByTime(200);

        expect(ws.sentMessages).toHaveLength(1);
        const event = JSON.parse(ws.sentMessages[0]!);
        expect(event.type).toBe(wsEvent);
      }
    });
  });

  // ── Concurrent connections ──────────────────────────────────────

  describe('Concurrent connections', () => {
    let manager: WebSocketManager;

    beforeEach(() => {
      manager = new WebSocketManager({ heartbeatIntervalMs: 60_000 });
    });

    afterEach(async () => {
      await manager.shutdown();
    });

    it('handles 50 simultaneous connections', () => {
      const clients = Array.from({ length: 50 }, () => {
        const ws = new MockWebSocket();
        manager.addClient(ws as unknown as WebSocket);
        return ws;
      });

      expect(manager.clientCount).toBe(50);

      // Broadcast to all
      manager.broadcast({
        type: 'task:updated',
        payload: { test: true },
        timestamp: new Date().toISOString(),
      });

      for (const ws of clients) {
        // welcome + 1 broadcast = 2
        expect(ws.sentMessages).toHaveLength(2);
      }
    });

    it('handles concurrent connect/disconnect', () => {
      const sockets: MockWebSocket[] = [];

      // Connect 10
      for (let i = 0; i < 10; i++) {
        const ws = new MockWebSocket();
        manager.addClient(ws as unknown as WebSocket);
        sockets.push(ws);
      }
      expect(manager.clientCount).toBe(10);

      // Disconnect first 5
      for (let i = 0; i < 5; i++) {
        sockets[i]!.emit('close');
      }
      expect(manager.clientCount).toBe(5);

      // Connect 3 more
      for (let i = 0; i < 3; i++) {
        manager.addClient(new MockWebSocket() as unknown as WebSocket);
      }
      expect(manager.clientCount).toBe(8);
    });

    it('different clients can have different subscriptions simultaneously', () => {
      const { ws: wsA } = createClient(manager);
      const { ws: wsB } = createClient(manager);

      wsA.simulateMessage({ action: 'subscribe', events: ['task:updated'] });
      wsB.simulateMessage({ action: 'subscribe', events: ['chat:message'] });

      manager.broadcast({ type: 'task:updated', payload: {}, timestamp: new Date().toISOString() });
      manager.broadcast({ type: 'chat:message', payload: {}, timestamp: new Date().toISOString() });

      expect(wsA.sentMessages).toHaveLength(1);
      expect(wsA.getEvents()[0]!.type).toBe('task:updated');

      expect(wsB.sentMessages).toHaveLength(1);
      expect(wsB.getEvents()[0]!.type).toBe('chat:message');
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────

  describe('Edge cases', () => {
    let manager: WebSocketManager;

    beforeEach(() => {
      manager = new WebSocketManager({ heartbeatIntervalMs: 60_000 });
    });

    afterEach(async () => {
      await manager.shutdown();
    });

    it('handles malformed JSON messages without crashing', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);

      ws.simulateMessage('not json {{{');
      ws.simulateMessage('');
      ws.simulateMessage('{"unknown": "action"}');

      expect(manager.clientCount).toBe(1); // still connected
    });

    it('handles message from disconnected client gracefully', () => {
      const ws = new MockWebSocket();
      manager.addClient(ws as unknown as WebSocket);
      ws.emit('close');

      // This should not throw
      expect(() => {
        manager.broadcast({ type: 'task:updated', payload: {}, timestamp: new Date().toISOString() });
      }).not.toThrow();
    });

    it('handles send errors without taking down other clients', () => {
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      manager.addClient(ws1 as unknown as WebSocket);
      manager.addClient(ws2 as unknown as WebSocket);

      // Make ws1 throw on send
      ws1.send = () => { throw new Error('Connection reset by peer'); };

      manager.broadcast({ type: 'task:updated', payload: {}, timestamp: new Date().toISOString() });

      // ws2 should still get the message (welcome + broadcast)
      expect(ws2.sentMessages).toHaveLength(2);
    });

    it('graceful shutdown closes all connections', async () => {
      const sockets = Array.from({ length: 5 }, () => {
        const ws = new MockWebSocket();
        manager.addClient(ws as unknown as WebSocket);
        return ws;
      });

      await manager.shutdown();

      expect(manager.clientCount).toBe(0);
      for (const ws of sockets) {
        expect(ws.closed).toBe(true);
      }
    });

    it('empty payload broadcasts succeed', () => {
      const { ws } = createClient(manager);

      manager.broadcast({ type: 'agent:status', payload: {}, timestamp: new Date().toISOString() });
      expect(ws.sentMessages).toHaveLength(1);
    });

    it('broadcasts with large payloads succeed', () => {
      const { ws } = createClient(manager);

      const largePayload: Record<string, unknown> = {};
      for (let i = 0; i < 100; i++) {
        largePayload[`key_${i}`] = 'A'.repeat(1000);
      }

      manager.broadcast({
        type: 'task:updated',
        payload: largePayload,
        timestamp: new Date().toISOString(),
      });

      expect(ws.sentMessages).toHaveLength(1);
      const parsed = JSON.parse(ws.sentMessages[0]!);
      expect(Object.keys(parsed.payload)).toHaveLength(100);
    });
  });
});
