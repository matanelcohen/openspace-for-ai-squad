/**
 * ActivityFeed — In-memory ring buffer for agent activity events (P3-3).
 *
 * Stores the last `capacity` events (default 500) in a circular buffer.
 * Sources events from FileWatcher changes and can be fed externally.
 * Emits new events via WebSocket `activity:new`.
 */

import type { ActivityEvent, ActivityEventType } from '@matanelcohen/openspace-shared';
import { nanoid } from 'nanoid';

import type { FileWatcher, FileWatcherEvent, FileWatcherEventType } from '../file-watcher/index.js';
import type { WebSocketManager, WsEnvelope } from '../websocket/index.js';

// ── File event → Activity event mapping ───────────────────────────

const FILE_EVENT_MAP: Record<FileWatcherEventType, { type: ActivityEventType; desc: string }> = {
  'agent:updated': { type: 'started', desc: 'Agent configuration updated' },
  'task:created': { type: 'spawned', desc: 'New task created' },
  'task:updated': { type: 'started', desc: 'Task updated' },
  'decision:added': { type: 'decision', desc: 'Decision recorded' },
  'config:changed': { type: 'started', desc: 'Squad configuration changed' },
  'team:updated': { type: 'started', desc: 'Team composition updated' },
};

// ── Ring buffer ───────────────────────────────────────────────────

export class ActivityFeed {
  private buffer: ActivityEvent[] = [];
  private readonly capacity: number;
  private wsManager: WebSocketManager | null = null;
  private fileWatcher: FileWatcher | null = null;
  private changeHandler: ((event: FileWatcherEvent) => void) | null = null;

  constructor(capacity = 500) {
    this.capacity = capacity;
  }

  /** Connect to a WebSocket manager for broadcasting. */
  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  /** Connect to a FileWatcher to auto-source events. */
  connectFileWatcher(watcher: FileWatcher): void {
    this.fileWatcher = watcher;

    this.changeHandler = (event: FileWatcherEvent) => {
      const mapping = FILE_EVENT_MAP[event.type];
      if (!mapping) return;

      // Extract agent ID from path if possible
      const agentId = this.extractAgentId(event.path, event.type);

      this.push({
        id: nanoid(12),
        type: mapping.type,
        agentId,
        description: `${mapping.desc}: ${event.path}`,
        timestamp: event.timestamp,
        relatedEntityId: null,
      });
    };

    this.fileWatcher.on('change', this.changeHandler);
  }

  /** Disconnect from FileWatcher. */
  disconnectFileWatcher(): void {
    if (this.fileWatcher && this.changeHandler) {
      this.fileWatcher.off('change', this.changeHandler);
      this.changeHandler = null;
      this.fileWatcher = null;
    }
  }

  /** Push a new event into the ring buffer and broadcast via WebSocket. */
  push(event: ActivityEvent): void {
    this.buffer.push(event);

    // Ring buffer: trim from the front when over capacity
    if (this.buffer.length > this.capacity) {
      this.buffer = this.buffer.slice(this.buffer.length - this.capacity);
    }

    // Broadcast via WebSocket
    if (this.wsManager) {
      const envelope: WsEnvelope = {
        type: 'activity:new',
        payload: event as unknown as Record<string, unknown>,
        timestamp: event.timestamp,
      };
      this.wsManager.broadcast(envelope);
    }
  }

  /**
   * Get paginated history, newest first.
   * @param limit  Max items to return (default 50).
   * @param offset Skip this many items from the newest end.
   */
  getHistory(limit = 50, offset = 0): { events: ActivityEvent[]; total: number } {
    // Return newest first
    const sorted = [...this.buffer].reverse();
    const page = sorted.slice(offset, offset + limit);
    return { events: page, total: this.buffer.length };
  }

  /** Current number of events in the buffer. */
  get size(): number {
    return this.buffer.length;
  }

  /** Clear all events. */
  clear(): void {
    this.buffer = [];
  }

  // ── Private ───────────────────────────────────────────────────

  private extractAgentId(path: string, eventType: FileWatcherEventType): string {
    // agents/bender/charter.md → bender
    if (eventType === 'agent:updated' && path.startsWith('agents/')) {
      const parts = path.split('/');
      return parts[1] ?? 'unknown';
    }
    // Default: system
    return 'system';
  }
}
