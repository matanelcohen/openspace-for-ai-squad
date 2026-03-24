/**
 * WebSocket event protocol types.
 *
 * Every message over the wire follows the `WsEnvelope` shape:
 *   { type: string, payload: object, timestamp: string }
 */

// ── Event type constants ──────────────────────────────────────────

export const WS_EVENT_TYPES = [
  'agent:status',
  'task:updated',
  'task:created',
  'decision:added',
  'activity:new',
  'chat:message',
  'chat:typing',
  'voice:session',
  'voice:transcript',
  'voice:audio',
  'voice:speaking',
] as const;

export type WsEventType = (typeof WS_EVENT_TYPES)[number];

// ── Wire protocol ─────────────────────────────────────────────────

/** The envelope every WebSocket message is wrapped in. */
export interface WsEnvelope<T extends WsEventType = WsEventType> {
  type: T;
  payload: Record<string, unknown>;
  timestamp: string;
}

/** Client → Server: subscribe to specific event types. */
export interface WsSubscribeMessage {
  action: 'subscribe';
  events: WsEventType[];
}

/** Client → Server: unsubscribe from event types. */
export interface WsUnsubscribeMessage {
  action: 'unsubscribe';
  events: WsEventType[];
}

/** Client → Server: heartbeat pong response. */
export interface WsPongMessage {
  action: 'pong';
}

export type WsClientMessage = WsSubscribeMessage | WsUnsubscribeMessage | WsPongMessage;

// ── Connection info ───────────────────────────────────────────────

export interface WsClientInfo {
  /** Unique connection ID. */
  id: string;
  /** Event types this client is subscribed to (empty = all). */
  subscriptions: Set<WsEventType>;
  /** Timestamp of last pong received (for heartbeat tracking). */
  lastPong: number;
  /** Whether the client has responded to the latest ping. */
  alive: boolean;
}
