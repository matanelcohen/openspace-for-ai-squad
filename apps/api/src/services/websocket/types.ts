/**
 * WebSocket event protocol types.
 *
 * Every message over the wire follows the `WsEnvelope` shape:
 *   { type: string, payload: object, timestamp: string }
 */

// ── Event type constants ──────────────────────────────────────────

export const WS_EVENT_TYPES = [
  'agent:status',
  'agent:working',
  'agent:idle',
  'task:updated',
  'task:created',
  'decision:added',
  'activity:new',
  'chat:message',
  'chat:typing',
  'chat:cleared',
  'channel:created',
  'channel:updated',
  'channel:deleted',
  'voice:session',
  'voice:transcript',
  'voice:audio',
  'voice:speaking',
  'task:suggestion',
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

/** Client → Server: send a chat message to a channel or agent. */
export interface WsChatSendMessage {
  action: 'chat:send';
  sender: string;
  recipient: string;
  content: string;
  threadId?: string | null;
}

/** Client → Server: join a channel to receive its messages. */
export interface WsChannelJoinMessage {
  action: 'channel:join';
  channelId: string;
}

/** Client → Server: leave a channel to stop receiving its messages. */
export interface WsChannelLeaveMessage {
  action: 'channel:leave';
  channelId: string;
}

/** Client → Server: bind a user/agent identity to this connection. */
export interface WsIdentifyMessage {
  action: 'identify';
  userId: string;
}

export type WsClientMessage =
  | WsSubscribeMessage
  | WsUnsubscribeMessage
  | WsPongMessage
  | WsChatSendMessage
  | WsChannelJoinMessage
  | WsChannelLeaveMessage
  | WsIdentifyMessage;

// ── Error envelope ────────────────────────────────────────────────

/** Server → Client: error response sent to a specific client. */
export interface WsErrorEnvelope {
  type: 'error';
  code: string;
  message: string;
  timestamp: string;
}

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
