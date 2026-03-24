import { resolve } from 'node:path';

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
import voiceRoute from './routes/voice.js';
import { ActivityFeed } from './services/activity/index.js';
import { AgentWorkerService } from './services/agent-worker/index.js';
import type { AIProvider } from './services/ai/copilot-provider.js';
import { createAIProvider } from './services/ai/copilot-provider.js';
import { ChatService } from './services/chat/index.js';
import { openDatabase } from './services/db/index.js';
import { SquadParser } from './services/squad-parser/index.js';
import {
  ConversationContextManager,
  VoiceRouter,
  VoiceSessionManager,
} from './services/voice/index.js';
import type { WebSocketManager } from './services/websocket/index.js';
import { wsPlugin } from './services/websocket/index.js';

/** Voice service bundle exposed on the Fastify instance. */
export interface VoiceServices {
  sessionManager: VoiceSessionManager;
  router: VoiceRouter;
  context: ConversationContextManager;
  aiProvider: AIProvider | null;
  chatAgents: Array<{ id: string; name: string; role: string; personality: string }>;
}

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
  /** Pre-created AI provider (for testing). */
  aiProvider?: AIProvider | null;
}

export function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
  });

  // Initialize SQLite database if not provided
  const squadDir = opts.squadDir ?? resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
  const db = opts.db ?? openDatabase({ squadDir });

  // Decorate with a SquadParser instance
  const parser = new SquadParser(squadDir);
  app.decorate('squadParser', parser);

  // Activity feed (in-memory ring buffer)
  const activityFeed = new ActivityFeed();
  app.decorate('activityFeed', activityFeed);

  // Chat service
  const chatService = new ChatService({
    db: db,
    sessionsDir: opts.sessionsDir ?? resolve(squadDir, 'sessions'),
    aiProvider: opts.aiProvider ?? null,
  });
  app.decorate('chatService', chatService);

  // Voice services
  const AGENT_PROFILES = [
    {
      id: 'leela',
      name: 'Leela',
      role: 'Lead',
      personality: 'Strategic, decisive, direct. Keeps the team focused on what matters.',
    },
    {
      id: 'fry',
      name: 'Fry',
      role: 'Frontend Dev',
      personality: 'Enthusiastic, creative, friendly. Loves building beautiful UIs.',
    },
    {
      id: 'bender',
      name: 'Bender',
      role: 'Backend Dev',
      personality: 'Blunt, efficient, matter-of-fact. Gets things done with minimal fuss.',
    },
    {
      id: 'zoidberg',
      name: 'Zoidberg',
      role: 'Tester',
      personality: 'Methodical, thorough, precise. Finds edge cases others miss.',
    },
  ];

  const voiceServices: VoiceServices = {
    sessionManager: new VoiceSessionManager(),
    router: new VoiceRouter(),
    context: new ConversationContextManager({
      sessionsDir: opts.sessionsDir ?? resolve(squadDir, 'sessions'),
    }),
    aiProvider: opts.aiProvider ?? null,
    chatAgents: AGENT_PROFILES,
  };
  app.decorate('voiceServices', voiceServices);

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

    // Initialize AI provider and connect to chat + voice + worker services
    if (!opts.aiProvider) {
      const provider = await createAIProvider(undefined, {
        workingDirectory: resolve(squadDir, '..'),
      });
      chatService.setAIProvider(provider);
      voiceServices.aiProvider = provider;
      voiceServices.router = new VoiceRouter({ llmRouter: provider });

      // Start agent worker service
      const workerService = new AgentWorkerService({
        tasksDir: resolve(squadDir, 'tasks'),
        aiProvider: provider,
        activityFeed,
        wsManager: app.wsManager ?? null,
        agents: AGENT_PROFILES,
      });
      workerService.start();
      app.decorate('agentWorker', workerService);

      // Shut down worker on close
      app.addHook('onClose', async () => {
        workerService.stop();
      });
    }

    // Bridge voice session events to WebSocket
    const vsm = voiceServices.sessionManager;
    vsm.on('session:created', (session: Record<string, unknown>) => {
      app.wsManager?.broadcast({
        type: 'voice:session',
        payload: { action: 'created', ...session },
        timestamp: new Date().toISOString(),
      });
    });
    vsm.on('session:ended', (session: Record<string, unknown>) => {
      app.wsManager?.broadcast({
        type: 'voice:session',
        payload: { action: 'ended', ...session },
        timestamp: new Date().toISOString(),
      });
    });
    vsm.on('participant:speaking', (event: Record<string, unknown>) => {
      app.wsManager?.broadcast({
        type: 'voice:speaking',
        payload: { ...event, isSpeaking: true },
        timestamp: new Date().toISOString(),
      });
    });
    vsm.on('participant:silent', (event: Record<string, unknown>) => {
      app.wsManager?.broadcast({
        type: 'voice:speaking',
        payload: { ...event, isSpeaking: false },
        timestamp: new Date().toISOString(),
      });
    });
  });

  // Routes
  app.register(healthRoute);
  app.register(agentsRoute, { prefix: '/api' });
  app.register(tasksRoute, { prefix: '/api' });
  app.register(decisionsRoute, { prefix: '/api' });
  app.register(squadRoute, { prefix: '/api' });
  app.register(activityRoute, { prefix: '/api' });
  app.register(chatRoute, { prefix: '/api' });
  app.register(voiceRoute, { prefix: '/api' });

  app.setErrorHandler((error, _request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const code = statusCode >= 500 ? 'INTERNAL_ERROR' : 'VALIDATION_ERROR';
    reply.status(statusCode).send({
      error: (error as Error).message || 'Internal Server Error',
      code,
    });
  });

  return app;
}

// Augment Fastify types so routes can access squadParser
declare module 'fastify' {
  interface FastifyInstance {
    squadParser: SquadParser;
    agentWorker?: AgentWorkerService;
  }
}
