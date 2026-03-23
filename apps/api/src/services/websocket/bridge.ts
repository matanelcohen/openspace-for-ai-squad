/**
 * FileWatcher → WebSocket bridge (P3-2).
 *
 * Connects FileWatcher events to WebSocket broadcasts with:
 *   - 200ms batch window to throttle rapid changes
 *   - Mapping from FileWatcher event types to WebSocket event types
 */

import type { FileWatcher, FileWatcherEvent } from '../file-watcher/index.js';
import type { WebSocketManager, WsEnvelope, WsEventType } from '../websocket/index.js';

// ── Event type mapping ────────────────────────────────────────────

const EVENT_MAP: Record<string, WsEventType> = {
  'agent:updated': 'agent:status',
  'task:created': 'task:created',
  'task:updated': 'task:updated',
  'decision:added': 'decision:added',
  'config:changed': 'agent:status', // config changes → generic status update
  'team:updated': 'agent:status',   // team changes → generic status update
};

// ── Bridge ────────────────────────────────────────────────────────

export interface FileWatcherBridgeOptions {
  /** Batch window in milliseconds. Defaults to 200. */
  batchWindowMs?: number;
}

export class FileWatcherBridge {
  private readonly watcher: FileWatcher;
  private readonly wsManager: WebSocketManager;
  private readonly batchWindowMs: number;

  private pendingEvents: WsEnvelope[] = [];
  private batchTimer: ReturnType<typeof setTimeout> | null = null;
  private changeHandler: ((event: FileWatcherEvent) => void) | null = null;

  constructor(
    watcher: FileWatcher,
    wsManager: WebSocketManager,
    opts?: FileWatcherBridgeOptions,
  ) {
    this.watcher = watcher;
    this.wsManager = wsManager;
    this.batchWindowMs = opts?.batchWindowMs ?? 200;
  }

  /** Start listening to FileWatcher events and forwarding to WebSocket. */
  start(): void {
    this.changeHandler = (event: FileWatcherEvent) => {
      const wsType = EVENT_MAP[event.type];
      if (!wsType) return;

      const envelope: WsEnvelope = {
        type: wsType,
        payload: {
          fileEvent: event.type,
          path: event.path,
        },
        timestamp: event.timestamp,
      };

      this.pendingEvents.push(envelope);
      this.scheduleBatch();
    };

    this.watcher.on('change', this.changeHandler);
  }

  /** Stop listening and flush any pending events. */
  stop(): void {
    if (this.changeHandler) {
      this.watcher.off('change', this.changeHandler);
      this.changeHandler = null;
    }
    this.flush();
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /** Number of events waiting in the batch buffer. */
  get pendingCount(): number {
    return this.pendingEvents.length;
  }

  // ── Private ───────────────────────────────────────────────────

  private scheduleBatch(): void {
    if (this.batchTimer) return; // already scheduled
    this.batchTimer = setTimeout(() => this.flush(), this.batchWindowMs);
  }

  private flush(): void {
    this.batchTimer = null;
    const events = this.pendingEvents;
    this.pendingEvents = [];

    // Deduplicate: keep last event per type+path combo
    const seen = new Map<string, WsEnvelope>();
    for (const evt of events) {
      const key = `${evt.type}:${(evt.payload as Record<string, unknown>).path}`;
      seen.set(key, evt);
    }

    for (const envelope of seen.values()) {
      this.wsManager.broadcast(envelope);
    }
  }
}
