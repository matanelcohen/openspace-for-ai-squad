/**
 * Fastify WebSocket plugin — registers @fastify/websocket and exposes
 * the WebSocketManager on the Fastify instance.
 *
 * Clients connect to `GET /ws` and are immediately registered with the
 * WebSocketManager for event broadcasting, subscriptions, and heartbeat.
 */

import type { FastifyPluginAsync } from 'fastify';
import websocketPlugin from '@fastify/websocket';

import { WebSocketManager } from './manager.js';

export interface WebSocketPluginOptions {
  /** Optional pre-created manager (useful for testing). */
  manager?: WebSocketManager;
}

const wsPlugin: FastifyPluginAsync<WebSocketPluginOptions> = async (app, opts) => {
  const manager = opts.manager ?? new WebSocketManager();

  // Register @fastify/websocket
  await app.register(websocketPlugin);

  // Decorate app with the manager
  app.decorate('wsManager', manager);

  // Start heartbeat
  manager.startHeartbeat();

  // WebSocket route
  app.get('/ws', { websocket: true }, (socket) => {
    manager.addClient(socket);
  });

  // Clean shutdown
  app.addHook('onClose', async () => {
    await manager.shutdown();
  });
};

export default wsPlugin;

// ── Fastify type augmentation ────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    wsManager: WebSocketManager;
  }
}
