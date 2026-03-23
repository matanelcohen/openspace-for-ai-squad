/**
 * WebSocketManager — Manages connected clients, subscriptions, heartbeat,
 * and event broadcasting.
 *
 * Usage:
 *   const mgr = new WebSocketManager();
 *   mgr.addClient(ws);          // on new connection
 *   mgr.broadcast(envelope);    // push to all matching subscribers
 *   mgr.startHeartbeat();       // begin ping/pong cycle
 *   await mgr.shutdown();       // clean close
 */

import { nanoid } from 'nanoid';
import type { WebSocket } from 'ws';

import type {
  WsClientInfo,
  WsClientMessage,
  WsEnvelope,
} from './types.js';
import { WS_EVENT_TYPES } from './types.js';

// ── Defaults ──────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000; // ping every 30s
const PONG_TIMEOUT_MS = 10_000; // drop if no pong within 10s

// ── Manager ───────────────────────────────────────────────────────

export class WebSocketManager {
  /** Map from client-id → { ws, info }. */
  private clients = new Map<string, { ws: WebSocket; info: WsClientInfo }>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  readonly heartbeatIntervalMs: number;
  readonly pongTimeoutMs: number;

  constructor(opts?: { heartbeatIntervalMs?: number; pongTimeoutMs?: number }) {
    this.heartbeatIntervalMs = opts?.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
    this.pongTimeoutMs = opts?.pongTimeoutMs ?? PONG_TIMEOUT_MS;
  }

  // ── Connection lifecycle ──────────────────────────────────────

  /** Register a new WebSocket connection. Returns the assigned client ID. */
  addClient(ws: WebSocket): string {
    const id = nanoid(12);
    const info: WsClientInfo = {
      id,
      subscriptions: new Set(),
      lastPong: Date.now(),
      alive: true,
    };

    this.clients.set(id, { ws, info });

    ws.on('message', (raw: Buffer | string) => {
      this.handleMessage(id, raw);
    });

    ws.on('close', () => {
      this.clients.delete(id);
    });

    ws.on('error', () => {
      this.clients.delete(id);
    });

    // Send welcome with client ID
    this.send(ws, {
      type: 'agent:status' as const,
      payload: { connected: true, clientId: id },
      timestamp: new Date().toISOString(),
    });

    return id;
  }

  /** Remove a client by ID. */
  removeClient(id: string): void {
    const entry = this.clients.get(id);
    if (entry) {
      try {
        entry.ws.close(1000, 'Server closing connection');
      } catch {
        // already closed
      }
      this.clients.delete(id);
    }
  }

  /** Number of currently connected clients. */
  get clientCount(): number {
    return this.clients.size;
  }

  /** Get all connected client IDs. */
  getClientIds(): string[] {
    return [...this.clients.keys()];
  }

  // ── Broadcasting ──────────────────────────────────────────────

  /**
   * Send an event to all connected clients that are subscribed to
   * the event type (or have no filters = subscribed to everything).
   */
  broadcast(envelope: WsEnvelope): void {
    const data = JSON.stringify(envelope);

    for (const { ws, info } of this.clients.values()) {
      if (ws.readyState !== 1 /* WebSocket.OPEN */) continue;

      // If client has subscriptions, filter; otherwise deliver everything
      if (info.subscriptions.size > 0 && !info.subscriptions.has(envelope.type)) {
        continue;
      }

      try {
        ws.send(data);
      } catch {
        // best-effort delivery
      }
    }
  }

  // ── Heartbeat ─────────────────────────────────────────────────

  /** Start periodic ping/pong heartbeat. */
  startHeartbeat(): void {
    if (this.heartbeatTimer) return;

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();

      for (const [id, { ws, info }] of this.clients) {
        if (!info.alive) {
          // No pong since last ping — terminate
          try {
            ws.terminate();
          } catch {
            // ignore
          }
          this.clients.delete(id);
          continue;
        }

        // Mark as not-alive until next pong
        info.alive = false;
        info.lastPong = now;

        try {
          ws.ping();
        } catch {
          this.clients.delete(id);
        }
      }
    }, this.heartbeatIntervalMs);
  }

  /** Stop heartbeat. */
  stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── Shutdown ──────────────────────────────────────────────────

  /** Gracefully close all connections and stop heartbeat. */
  async shutdown(): Promise<void> {
    this.stopHeartbeat();

    for (const { ws } of this.clients.values()) {
      try {
        ws.close(1001, 'Server shutting down');
      } catch {
        // already closed
      }
    }

    this.clients.clear();
  }

  // ── Private ───────────────────────────────────────────────────

  /** Handle an incoming client message. */
  private handleMessage(clientId: string, raw: Buffer | string): void {
    const entry = this.clients.get(clientId);
    if (!entry) return;

    let msg: WsClientMessage;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8')) as WsClientMessage;
    } catch {
      return; // ignore unparseable messages
    }

    switch (msg.action) {
      case 'subscribe':
        for (const evt of msg.events) {
          if ((WS_EVENT_TYPES as readonly string[]).includes(evt)) {
            entry.info.subscriptions.add(evt);
          }
        }
        break;

      case 'unsubscribe':
        for (const evt of msg.events) {
          entry.info.subscriptions.delete(evt);
        }
        break;

      case 'pong':
        entry.info.alive = true;
        entry.info.lastPong = Date.now();
        break;
    }
  }

  /** Send a JSON message to a single WebSocket. */
  private send(ws: WebSocket, data: WsEnvelope): void {
    if (ws.readyState === 1 /* OPEN */) {
      try {
        ws.send(JSON.stringify(data));
      } catch {
        // best-effort
      }
    }
  }
}
