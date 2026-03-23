/**
 * Tests for FileWatcherBridge — P3-2
 *
 * Tests event mapping, throttling/batching, and deduplication.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

import { FileWatcherBridge } from './bridge.js';
import { WebSocketManager } from './manager.js';
import type { FileWatcherEvent } from '../file-watcher/index.js';
import type { FileWatcher } from '../file-watcher/index.js';

// ── Mock FileWatcher ──────────────────────────────────────────────

class MockFileWatcher extends EventEmitter {
  // Simulate emitting a change event
  triggerChange(event: FileWatcherEvent): void {
    this.emit('change', event);
  }
}

// ── Mock WebSocket for the manager ────────────────────────────────

class MockWebSocket extends EventEmitter {
  readyState = 1;
  sentMessages: string[] = [];
  send(data: string) { this.sentMessages.push(data); }
  close() { this.readyState = 3; }
  terminate() { this.readyState = 3; }
  ping() {}
}

// ── Tests ─────────────────────────────────────────────────────────

describe('FileWatcherBridge', () => {
  let watcher: MockFileWatcher;
  let wsManager: WebSocketManager;
  let bridge: FileWatcherBridge;
  let clientWs: MockWebSocket;

  beforeEach(() => {
    vi.useFakeTimers();

    watcher = new MockFileWatcher();
    wsManager = new WebSocketManager({ heartbeatIntervalMs: 60_000 });

    // Connect a mock client
    clientWs = new MockWebSocket();
    wsManager.addClient(clientWs as unknown as import('ws').WebSocket);
    clientWs.sentMessages = []; // clear welcome message

    bridge = new FileWatcherBridge(
      watcher as unknown as FileWatcher,
      wsManager,
      { batchWindowMs: 200 },
    );
  });

  afterEach(async () => {
    bridge.stop();
    await wsManager.shutdown();
    vi.useRealTimers();
  });

  it('should map file watcher events to WebSocket events', () => {
    bridge.start();

    watcher.triggerChange({
      type: 'task:created',
      path: 'tasks/auth-endpoint.md',
      timestamp: '2026-03-23T12:00:00Z',
    });

    // Still in batch window
    expect(clientWs.sentMessages).toHaveLength(0);

    // Flush
    vi.advanceTimersByTime(200);

    expect(clientWs.sentMessages).toHaveLength(1);
    const msg = JSON.parse(clientWs.sentMessages[0]!);
    expect(msg.type).toBe('task:created');
    expect(msg.payload.path).toBe('tasks/auth-endpoint.md');
  });

  it('should batch multiple events within the window', () => {
    bridge.start();

    watcher.triggerChange({
      type: 'task:created',
      path: 'tasks/task-1.md',
      timestamp: '2026-03-23T12:00:00Z',
    });

    vi.advanceTimersByTime(50);

    watcher.triggerChange({
      type: 'task:updated',
      path: 'tasks/task-2.md',
      timestamp: '2026-03-23T12:00:00Z',
    });

    vi.advanceTimersByTime(50);

    watcher.triggerChange({
      type: 'decision:added',
      path: 'decisions.md',
      timestamp: '2026-03-23T12:00:01Z',
    });

    // Still within 200ms window of the first event
    expect(clientWs.sentMessages).toHaveLength(0);

    // Flush
    vi.advanceTimersByTime(200);

    // All three events should arrive
    expect(clientWs.sentMessages).toHaveLength(3);
  });

  it('should deduplicate same type+path events within a batch', () => {
    bridge.start();

    // Same file changes twice rapidly
    watcher.triggerChange({
      type: 'task:updated',
      path: 'tasks/task-1.md',
      timestamp: '2026-03-23T12:00:00Z',
    });

    vi.advanceTimersByTime(50);

    watcher.triggerChange({
      type: 'task:updated',
      path: 'tasks/task-1.md',
      timestamp: '2026-03-23T12:00:01Z',
    });

    vi.advanceTimersByTime(200);

    // Only one event (the latest) should be broadcast
    expect(clientWs.sentMessages).toHaveLength(1);
    const msg = JSON.parse(clientWs.sentMessages[0]!);
    expect(msg.payload.path).toBe('tasks/task-1.md');
  });

  it('should map agent:updated to agent:status', () => {
    bridge.start();

    watcher.triggerChange({
      type: 'agent:updated',
      path: 'agents/bender/charter.md',
      timestamp: '2026-03-23T12:00:00Z',
    });

    vi.advanceTimersByTime(200);

    expect(clientWs.sentMessages).toHaveLength(1);
    const msg = JSON.parse(clientWs.sentMessages[0]!);
    expect(msg.type).toBe('agent:status');
  });

  it('should stop listening when stop() is called', () => {
    bridge.start();
    bridge.stop();

    watcher.triggerChange({
      type: 'task:created',
      path: 'tasks/task-1.md',
      timestamp: '2026-03-23T12:00:00Z',
    });

    vi.advanceTimersByTime(200);

    expect(clientWs.sentMessages).toHaveLength(0);
  });

  it('should track pending event count', () => {
    bridge.start();

    expect(bridge.pendingCount).toBe(0);

    watcher.triggerChange({
      type: 'task:created',
      path: 'tasks/task-1.md',
      timestamp: '2026-03-23T12:00:00Z',
    });

    expect(bridge.pendingCount).toBe(1);

    vi.advanceTimersByTime(200);
    expect(bridge.pendingCount).toBe(0);
  });
});
