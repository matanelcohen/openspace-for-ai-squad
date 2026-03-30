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
  WsChannelJoinMessage,
  WsChannelLeaveMessage,
  WsClientInfo,
  WsClientMessage,
  WsEnvelope,
  WsErrorEnvelope,
  WsIdentifyMessage,
} from './types.js';
import { WS_EVENT_TYPES } from './types.js';

// ── Chat handler type ─────────────────────────────────────────────

/**
 * Callback invoked when a client sends a `chat:send` message.
 * The handler is responsible for membership validation, persistence,
 * and broadcasting. It should throw on validation failures
 * (e.g. ChannelMembershipError) so the manager can relay the error
 * back to the sender.
 */
export type ChatSendHandler = (input: {
  sender: string;
  recipient: string;
  content: string;
  threadId?: string | null;
}) => Promise<void>;

// ── Defaults ──────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000; // ping every 30s
const PONG_TIMEOUT_MS = 10_000; // drop if no pong within 10s

// ── Manager ───────────────────────────────────────────────────────

export class WebSocketManager {
  /** Map from client-id → { ws, info }. */
  private clients = new Map<string, { ws: WebSocket; info: WsClientInfo }>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  /** Map from agent-id → client-id (for channel-aware routing). */
  private agentToClient = new Map<string, Set<string>>();
  /** Map from client-id → set of channel IDs the client has joined. */
  private clientChannels = new Map<string, Set<string>>();
  /** Handler invoked when a client sends a chat:send message. */
  private chatSendHandler: ChatSendHandler | null = null;

  readonly heartbeatIntervalMs: number;
  readonly pongTimeoutMs: number;

  constructor(opts?: { heartbeatIntervalMs?: number; pongTimeoutMs?: number }) {
    this.heartbeatIntervalMs = opts?.heartbeatIntervalMs ?? HEARTBEAT_INTERVAL_MS;
    this.pongTimeoutMs = opts?.pongTimeoutMs ?? PONG_TIMEOUT_MS;
  }

  /**
   * Register a handler for incoming `chat:send` messages.
   * The handler should call ChatService.send() which validates
   * channel membership before persisting or broadcasting.
   */
  setChatSendHandler(handler: ChatSendHandler): void {
    this.chatSendHandler = handler;
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
      this.clientChannels.delete(id);
    });

    ws.on('error', () => {
      this.clients.delete(id);
      this.clientChannels.delete(id);
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

  /**
   * Send a channel-scoped event only to clients that have joined the
   * specified channel (via the `channel:join` action). Respects event
   * subscription filters the same way `broadcast()` does.
   */
  broadcastToChannel(channelId: string, envelope: WsEnvelope): void {
    const data = JSON.stringify(envelope);

    for (const [clientId, { ws, info }] of this.clients) {
      if (ws.readyState !== 1 /* WebSocket.OPEN */) continue;

      // Subscription filter (same as broadcast)
      if (info.subscriptions.size > 0 && !info.subscriptions.has(envelope.type)) {
        continue;
      }

      // Channel membership filter — skip clients that haven't joined this channel
      const channels = this.clientChannels.get(clientId);
      if (!channels?.has(channelId)) continue;

      try {
        ws.send(data);
      } catch {
        // best-effort delivery
      }
    }
  }

  /** Check whether a client has joined a specific channel. */
  isClientInChannel(clientId: string, channelId: string): boolean {
    return this.clientChannels.get(clientId)?.has(channelId) ?? false;
  }

  /** Get the set of channel IDs a client has joined. */
  getClientChannels(clientId: string): ReadonlySet<string> {
    return this.clientChannels.get(clientId) ?? new Set();
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'));
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown error';
      this.sendError(entry.ws, 'INVALID_JSON', `Message parse failed: ${detail}`);
      return;
    }

    // Validate the parsed value is a non-null object with an action field
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      this.sendError(entry.ws, 'INVALID_FORMAT', 'Message must be a JSON object');
      return;
    }

    const msg = parsed as WsClientMessage;

    if (!('action' in msg) || typeof (msg as Record<string, unknown>).action !== 'string') {
      this.sendError(entry.ws, 'MISSING_ACTION', 'Message must include an "action" string field');
      return;
    }

    const raw_msg = msg as Record<string, unknown>;

    switch (msg.action) {
      case 'subscribe':
      case 'unsubscribe': {
        if (!Array.isArray(raw_msg.events)) {
          this.sendError(
            entry.ws,
            'INVALID_PAYLOAD',
            `"${msg.action}" requires an "events" array`,
          );
          return;
        }
        const events = raw_msg.events as unknown[];
        if (!events.every((e) => typeof e === 'string')) {
          this.sendError(
            entry.ws,
            'INVALID_PAYLOAD',
            `"${msg.action}" events must all be strings`,
          );
          return;
        }
        if (msg.action === 'subscribe') {
          for (const evt of events as string[]) {
            if ((WS_EVENT_TYPES as readonly string[]).includes(evt)) {
              entry.info.subscriptions.add(evt as import('./types.js').WsEventType);
            }
          }
        } else {
          for (const evt of events as string[]) {
            entry.info.subscriptions.delete(evt as import('./types.js').WsEventType);
          }
        }
        break;
      }

      case 'pong':
        entry.info.alive = true;
        entry.info.lastPong = Date.now();
        break;

      case 'chat:send': {
        const sender = raw_msg.sender;
        const recipient = raw_msg.recipient;
        const content = raw_msg.content;

        if (typeof sender !== 'string' || sender.length === 0) {
          this.sendError(entry.ws, 'INVALID_PAYLOAD', '"chat:send" requires a non-empty "sender" string');
          return;
        }
        if (typeof recipient !== 'string' || recipient.length === 0) {
          this.sendError(entry.ws, 'INVALID_PAYLOAD', '"chat:send" requires a non-empty "recipient" string');
          return;
        }
        if (typeof content !== 'string' || content.length === 0) {
          this.sendError(entry.ws, 'INVALID_PAYLOAD', '"chat:send" requires a non-empty "content" string');
          return;
        }
        this.handleChatSend(clientId, entry.ws, msg);
        break;
      }

      case 'channel:join': {
        if (typeof raw_msg.channelId !== 'string' || (raw_msg.channelId as string).length === 0) {
          this.sendError(entry.ws, 'INVALID_PAYLOAD', '"channel:join" requires a non-empty "channelId" string');
          return;
        }
        this.handleChannelJoin(clientId, msg);
        break;
      }

      case 'channel:leave': {
        if (typeof raw_msg.channelId !== 'string' || (raw_msg.channelId as string).length === 0) {
          this.sendError(entry.ws, 'INVALID_PAYLOAD', '"channel:leave" requires a non-empty "channelId" string');
          return;
        }
        this.handleChannelLeave(clientId, msg);
        break;
      }

      case 'identify': {
        if (typeof raw_msg.userId !== 'string' || (raw_msg.userId as string).length === 0) {
          this.sendError(entry.ws, 'INVALID_PAYLOAD', '"identify" requires a non-empty "userId" string');
          return;
        }
        this.handleIdentify(clientId, msg);
        break;
      }

      default:
        this.sendError(
          entry.ws,
          'UNKNOWN_ACTION',
          `Unknown action: ${(msg as Record<string, unknown>).action ?? '<missing>'}`,
        );
        break;
    }
  }

  /** Track which channels a client has joined. */
  private handleChannelJoin(clientId: string, msg: WsChannelJoinMessage): void {
    let channels = this.clientChannels.get(clientId);
    if (!channels) {
      channels = new Set();
      this.clientChannels.set(clientId, channels);
    }
    channels.add(msg.channelId);
  }

  /** Remove a channel from a client's joined set. */
  private handleChannelLeave(clientId: string, msg: WsChannelLeaveMessage): void {
    const channels = this.clientChannels.get(clientId);
    if (channels) {
      channels.delete(msg.channelId);
    }
  }

  /** Bind a user/agent identity to a client connection. */
  private handleIdentify(clientId: string, msg: WsIdentifyMessage): void {
    let clientSet = this.agentToClient.get(msg.userId);
    if (!clientSet) {
      clientSet = new Set();
      this.agentToClient.set(msg.userId, clientSet);
    }
    clientSet.add(clientId);
  }

  /**
   * Handle a `chat:send` message from a client.
   * Delegates to the registered chatSendHandler (which validates
   * channel membership). On failure, sends a WsErrorEnvelope back
   * to the originating client only — no broadcast, no leak.
   */
  private async handleChatSend(
    clientId: string,
    ws: WebSocket,
    msg: { sender: string; recipient: string; content: string; threadId?: string | null },
  ): Promise<void> {
    if (!this.chatSendHandler) {
      this.sendError(ws, 'NO_HANDLER', 'Chat send handler not configured');
      return;
    }

    try {
      await this.chatSendHandler({
        sender: msg.sender,
        recipient: msg.recipient,
        content: msg.content,
        threadId: msg.threadId,
      });
    } catch (err: unknown) {
      const error = err as Error & { code?: string };
      const code = error.code ?? 'SEND_FAILED';
      const message = error.message ?? 'Failed to send message';
      this.sendError(ws, code, message);
    }
  }

  /** Send a WsErrorEnvelope to a single client. */
  private sendError(ws: WebSocket, code: string, message: string): void {
    if (ws.readyState !== 1 /* OPEN */) return;

    const envelope: WsErrorEnvelope = {
      type: 'error',
      code,
      message,
      timestamp: new Date().toISOString(),
    };

    try {
      ws.send(JSON.stringify(envelope));
    } catch {
      // best-effort
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
