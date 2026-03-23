/**
 * WebSocket service — public API.
 */

export { WebSocketManager } from './manager.js';
export type { WebSocketPluginOptions } from './plugin.js';
export { default as wsPlugin } from './plugin.js';
export {
  WS_EVENT_TYPES,
  type WsClientInfo,
  type WsClientMessage,
  type WsEnvelope,
  type WsEventType,
  type WsPongMessage,
  type WsSubscribeMessage,
  type WsUnsubscribeMessage,
} from './types.js';
