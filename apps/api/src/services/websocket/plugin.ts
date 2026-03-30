/**
 * Fastify WebSocket plugin — registers @fastify/websocket and exposes
 * the WebSocketManager on the Fastify instance.
 *
 * Clients connect to `GET /ws` and are immediately registered with the
 * WebSocketManager for event broadcasting, subscriptions, and heartbeat.
 */

import websocketPlugin from '@fastify/websocket';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { WebSocketManager } from './manager.js';

export interface WebSocketPluginOptions {
  /** Optional pre-created manager (useful for testing). */
  manager?: WebSocketManager;
}

const wsPluginImpl: FastifyPluginAsync<WebSocketPluginOptions> = async (app, opts) => {
  const manager = opts.manager ?? new WebSocketManager();

  // Register @fastify/websocket — only handle our known WS paths
  await app.register(websocketPlugin, {
    options: {
      // Accept our known WebSocket routes; reject everything else (e.g. Next.js HMR)
      verifyClient: (info: { req: { url?: string } }, cb: (result: boolean) => void) => {
        const url = info.req.url ?? '';
        const path = url.split('?')[0];
        cb(path === '/ws' || path === '/api/terminal/ws');
      },
    },
  });

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

export default fp(wsPluginImpl);

// ── Fastify type augmentation ────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    wsManager: WebSocketManager;
  }
}
