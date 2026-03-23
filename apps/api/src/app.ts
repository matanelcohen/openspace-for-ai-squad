import cors from '@fastify/cors';
import type Database from 'better-sqlite3';
import Fastify, { type FastifyServerOptions } from 'fastify';

import activityRoute from './routes/activity.js';
import agentsRoute from './routes/agents.js';
import chatRoute from './routes/chat.js';
import decisionsRoute from './routes/decisions.js';
import healthRoute from './routes/health.js';
import squadRoute from './routes/squad.js';
import tasksRoute from './routes/tasks.js';
import { ActivityFeed } from './services/activity/index.js';
import { ChatService } from './services/chat/index.js';
import { SquadParser } from './services/squad-parser/index.js';
import type { WebSocketManager } from './services/websocket/index.js';
import { wsPlugin } from './services/websocket/index.js';

export interface AppOptions {
  logger?: FastifyServerOptions['logger'];
  /** Override the .squad/ directory for testing. */
  squadDir?: string;
  /** Pre-created SQLite database (for testing or external management). */
  db?: Database.Database | null;
  /** Pre-created WebSocket manager (for testing). */
  wsManager?: WebSocketManager;
  /** Override .squad/sessions/ directory for chat markdown logs. */
  sessionsDir?: string | null;
}

export function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
  });

  // Decorate with a SquadParser instance
  const parser = new SquadParser(opts.squadDir);
  app.decorate('squadParser', parser);

  // Activity feed (in-memory ring buffer)
  const activityFeed = new ActivityFeed();
  app.decorate('activityFeed', activityFeed);

  // Chat service
  const chatService = new ChatService({
    db: opts.db ?? null,
    sessionsDir: opts.sessionsDir ?? null,
  });
  app.decorate('chatService', chatService);

  // Plugins
  app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  });

  // WebSocket plugin
  app.register(wsPlugin, { manager: opts.wsManager });

  // Wire up activity feed + chat to wsManager after registration
  app.addHook('onReady', async () => {
    activityFeed.setWebSocketManager(app.wsManager);
    chatService.setWebSocketManager(app.wsManager);
  });

  // Routes
  app.register(healthRoute);
  app.register(agentsRoute, { prefix: '/api' });
  app.register(tasksRoute, { prefix: '/api' });
  app.register(decisionsRoute, { prefix: '/api' });
  app.register(squadRoute, { prefix: '/api' });
  app.register(activityRoute, { prefix: '/api' });
  app.register(chatRoute, { prefix: '/api' });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = error.statusCode ?? 500;
    const code = statusCode >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR';
    reply.status(statusCode).send({
      error: error.message || 'Internal Server Error',
      code,
    });
  });

  return app;
}

// Augment Fastify types so routes can access squadParser
declare module 'fastify' {
  interface FastifyInstance {
    squadParser: SquadParser;
  }
}
