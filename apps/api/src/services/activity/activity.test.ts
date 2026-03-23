/**
 * Tests for ActivityFeed — P3-3
 *
 * Tests ring buffer, pagination, FileWatcher integration, WebSocket emission.
 */

import { EventEmitter } from 'node:events';

import type { ActivityEvent } from '@openspace/shared';
import { beforeEach, describe, expect, it } from 'vitest';

import type { FileWatcher } from '../file-watcher/index.js';
import type { WebSocketManager } from '../websocket/index.js';
import { ActivityFeed } from './index.js';

// ── Mock WebSocket Manager ────────────────────────────────────────

class MockWsManager {
  broadcasts: Array<{ type: string; payload: Record<string, unknown>; timestamp: string }> = [];

  broadcast(envelope: { type: string; payload: Record<string, unknown>; timestamp: string }) {
    this.broadcasts.push(envelope);
  }
}

// ── Mock FileWatcher ──────────────────────────────────────────────

class MockFileWatcher extends EventEmitter {}

// ── Helpers ───────────────────────────────────────────────────────

function makeEvent(partial: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: partial.id ?? `evt-${Date.now()}-${Math.random()}`,
    type: partial.type ?? 'started',
    agentId: partial.agentId ?? 'bender',
    description: partial.description ?? 'Test event',
    timestamp: partial.timestamp ?? new Date().toISOString(),
    relatedEntityId: partial.relatedEntityId ?? null,
  };
}

// ── Tests ─────────────────────────────────────────────────────────

describe('ActivityFeed', () => {
  let feed: ActivityFeed;

  beforeEach(() => {
    feed = new ActivityFeed(10); // small capacity for testing
  });

  describe('ring buffer', () => {
    it('should store events up to capacity', () => {
      for (let i = 0; i < 10; i++) {
        feed.push(makeEvent({ id: `evt-${i}` }));
      }

      expect(feed.size).toBe(10);
    });

    it('should drop oldest events when over capacity', () => {
      for (let i = 0; i < 15; i++) {
        feed.push(makeEvent({ id: `evt-${i}` }));
      }

      expect(feed.size).toBe(10);

      // Should contain events 5-14 (oldest 5 dropped)
      const { events } = feed.getHistory(10);
      const ids = events.map((e) => e.id);
      expect(ids).not.toContain('evt-0');
      expect(ids).not.toContain('evt-4');
      expect(ids).toContain('evt-5');
      expect(ids).toContain('evt-14');
    });
  });

  describe('pagination', () => {
    beforeEach(() => {
      for (let i = 0; i < 8; i++) {
        feed.push(makeEvent({ id: `evt-${i}`, timestamp: `2026-01-01T00:00:0${i}Z` }));
      }
    });

    it('should return newest first', () => {
      const { events } = feed.getHistory(3);
      expect(events).toHaveLength(3);
      expect(events[0]!.id).toBe('evt-7');
      expect(events[1]!.id).toBe('evt-6');
      expect(events[2]!.id).toBe('evt-5');
    });

    it('should respect offset', () => {
      const { events } = feed.getHistory(3, 3);
      expect(events).toHaveLength(3);
      expect(events[0]!.id).toBe('evt-4');
      expect(events[1]!.id).toBe('evt-3');
      expect(events[2]!.id).toBe('evt-2');
    });

    it('should return total count', () => {
      const { total } = feed.getHistory(3);
      expect(total).toBe(8);
    });

    it('should handle offset beyond available events', () => {
      const { events } = feed.getHistory(3, 100);
      expect(events).toHaveLength(0);
    });
  });

  describe('WebSocket emission', () => {
    it('should broadcast activity:new events', () => {
      const mockWs = new MockWsManager();
      feed.setWebSocketManager(mockWs as unknown as WebSocketManager);

      const event = makeEvent();
      feed.push(event);

      expect(mockWs.broadcasts).toHaveLength(1);
      expect(mockWs.broadcasts[0]!.type).toBe('activity:new');
      expect((mockWs.broadcasts[0]!.payload as unknown as ActivityEvent).id).toBe(event.id);
    });
  });

  describe('FileWatcher integration', () => {
    it('should create activity events from file watcher changes', () => {
      const watcher = new MockFileWatcher();
      feed.connectFileWatcher(watcher as unknown as FileWatcher);

      watcher.emit('change', {
        type: 'task:created',
        path: 'tasks/new-task.md',
        timestamp: '2026-03-23T12:00:00Z',
      });

      expect(feed.size).toBe(1);
      const { events } = feed.getHistory();
      expect(events[0]!.type).toBe('spawned');
      expect(events[0]!.description).toContain('tasks/new-task.md');
    });

    it('should extract agent ID from agent file paths', () => {
      const watcher = new MockFileWatcher();
      feed.connectFileWatcher(watcher as unknown as FileWatcher);

      watcher.emit('change', {
        type: 'agent:updated',
        path: 'agents/bender/charter.md',
        timestamp: '2026-03-23T12:00:00Z',
      });

      const { events } = feed.getHistory();
      expect(events[0]!.agentId).toBe('bender');
    });

    it('should disconnect from file watcher', () => {
      const watcher = new MockFileWatcher();
      feed.connectFileWatcher(watcher as unknown as FileWatcher);
      feed.disconnectFileWatcher();

      watcher.emit('change', {
        type: 'task:created',
        path: 'tasks/new-task.md',
        timestamp: '2026-03-23T12:00:00Z',
      });

      expect(feed.size).toBe(0);
    });
  });

  describe('clear', () => {
    it('should clear all events', () => {
      feed.push(makeEvent());
      feed.push(makeEvent());
      expect(feed.size).toBe(2);

      feed.clear();
      expect(feed.size).toBe(0);
    });
  });
});
