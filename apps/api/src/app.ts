import { resolve } from 'node:path';

import cors from '@fastify/cors';
import { mcpPlugin } from '@openspace/mcp-server';
import type Database from 'better-sqlite3';
import Fastify, { type FastifyServerOptions } from 'fastify';

import { ErrorCodes, sendError } from './lib/api-errors.js';
import a2aRoute from './routes/a2a.js';
import activityRoute from './routes/activity.js';
import agentsRoute from './routes/agents.js';
import channelsRoute from './routes/channels.js';
import chatRoute from './routes/chat.js';
import decisionsRoute from './routes/decisions.js';
import healthRoute from './routes/health.js';
import knowledgeRoute from './routes/knowledge.js';
import otlpCollectorRoute from './routes/otlp-collector.js';
import sandboxesRoute from './routes/sandboxes.js';
import skillsRoute from './routes/skills.js';
import squadRoute from './routes/squad.js';
import terminalRoute from './routes/terminal.js';
import tasksRoute from './routes/tasks.js';
import teamMembersRoute from './routes/team-members.js';
import tracesRoute from './routes/traces.js';
import voiceRoute from './routes/voice.js';
import type { A2AService } from './services/a2a/index.js';
import { createA2AService } from './services/a2a/index.js';
import { SkillRegistryImpl } from './services/skill-registry/index.js';
import { seedBuiltinSkills } from './services/seed-skills.js';
import { ActivityFeed } from './services/activity/index.js';
import { AgentWorkerService } from './services/agent-worker/index.js';
import type { AIProvider } from './services/ai/copilot-provider.js';
import { createAIProvider } from './services/ai/copilot-provider.js';
import { AuthService } from './services/auth/index.js';
import { ChatService } from './services/chat/index.js';
import { openDatabase } from './services/db/index.js';
import { seedTeamMembers } from './services/db/seed-team.js';
import { SandboxService } from './services/sandbox/index.js';
import { KnowledgeSearchService } from './services/search/index.js';
import { SquadParser } from './services/squad-parser/index.js';
import { TraceService } from './services/traces/index.js';
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

  // Seed team members from .squad/team.md (no-op if already populated)
  seedTeamMembers(db, squadDir);

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

  // Auth service
  const authService = new AuthService({ db });
  app.decorate('authService', authService);

  // Skill registry
  const skillRegistry = new SkillRegistryImpl();
  seedBuiltinSkills(skillRegistry);
  app.decorate('skillRegistry', skillRegistry);

  // Knowledge search service
  const knowledgeSearch = new KnowledgeSearchService({ db });
  app.decorate('knowledgeSearch', knowledgeSearch);

  // Sandbox service (Docker container management)
  const sandboxService = new SandboxService();
  app.decorate('sandboxService', sandboxService);

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
    origin:
      process.env.CORS_ORIGIN === '*' ? true : (process.env.CORS_ORIGIN ?? 'http://localhost:3000'),
  });

  // WebSocket plugin
  app.register(wsPlugin, { manager: opts.wsManager });

  // MCP server — SSE transport at /mcp/sse, messages at /mcp/messages
  app.register(mcpPlugin, { prefix: '/mcp' });

  // Wire up activity feed + chat to wsManager after registration
  app.addHook('onReady', async () => {
    activityFeed.setWebSocketManager(app.wsManager);
    chatService.setWebSocketManager(app.wsManager);
    chatService.setActivityFeed(activityFeed);

    // Wire WebSocket chat:send messages through ChatService.send()
    // which validates channel membership before persisting or broadcasting.
    app.wsManager.setChatSendHandler(async (input) => {
      await chatService.send(input);
    });

    // Initialize AI provider and connect to chat + voice + worker services
    if (!opts.aiProvider) {
      const provider = await createAIProvider(undefined, {
        workingDirectory: resolve(squadDir, '..'),
        traceService,
      });
      chatService.setAIProvider(provider);
      voiceServices.aiProvider = provider;
      voiceServices.router = new VoiceRouter({ llmRouter: provider });

      // Compute A2A base URL (shared by worker delegation + A2A service)
      const port = Number(process.env.PORT) || 3001;
      const host = process.env.HOST || 'localhost';
      const a2aBaseUrl = process.env.A2A_BASE_URL || `http://${host}:${port}`;

      // Start agent worker service with A2A delegation capability
      const workerService = new AgentWorkerService({
        tasksDir: resolve(squadDir, 'tasks'),
        aiProvider: provider,
        activityFeed,
        wsManager: app.wsManager ?? null,
        agents: AGENT_PROFILES,
        a2aBaseUrl,
      });
      await workerService.start();
      app.decorate('agentWorker', workerService);

      // Initialize A2A service with bridge to chat + activity + tasks
      const a2aService = createA2AService({
        agents: AGENT_PROFILES,
        aiProvider: provider,
        baseUrl: a2aBaseUrl,
        db,
        bridge: {
          chatService,
          wsManager: app.wsManager ?? null,
          activityFeed,
          tasksDir: resolve(squadDir, 'tasks'),
        },
      });
      app.decorate('a2aService', a2aService);

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

  // Trace service for recording AI interactions
  const traceService = new TraceService(db);
  app.decorate('traceService', traceService);

  // Decorate Fastify instance with the SQLite database
  app.decorate('db', db);

  // Shut down sandbox containers on app close
  app.addHook('onClose', async () => {
    await sandboxService.shutdown();
  });

  // Routes
  app.register(healthRoute);
  app.register(a2aRoute);
  app.register(otlpCollectorRoute); // OTLP collector at /v1/traces (no prefix)
  app.register(agentsRoute, { prefix: '/api' });
  app.register(tasksRoute, { prefix: '/api' });
  app.register(decisionsRoute, { prefix: '/api' });
  app.register(squadRoute, { prefix: '/api' });
  app.register(activityRoute, { prefix: '/api' });
  app.register(chatRoute, { prefix: '/api' });
  app.register(voiceRoute, { prefix: '/api' });
  app.register(channelsRoute, { prefix: '/api' });
  app.register(knowledgeRoute, { prefix: '/api' });
  app.register(teamMembersRoute, { prefix: '/api' });
  app.register(sandboxesRoute, { prefix: '/api' });
  app.register(tracesRoute, { prefix: '/api' });
  app.register(skillsRoute, { prefix: '/api' });
  // Terminal route
  app.register(terminalRoute, { prefix: '/api' });

  app.setErrorHandler((error, request, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
    const code = statusCode >= 500 ? ErrorCodes.INTERNAL_ERROR : ErrorCodes.VALIDATION_ERROR;
    if (statusCode >= 500) {
      request.log.error(error, 'Unhandled error');
    }
    return sendError(reply, statusCode, code, (error as Error).message || 'Internal Server Error');
  });

  return app;
}

// Augment Fastify types so routes can access squadParser
declare module 'fastify' {
  interface FastifyInstance {
    squadParser: SquadParser;
    knowledgeSearch: KnowledgeSearchService;
    agentWorker?: AgentWorkerService;
    a2aService?: A2AService;
    sandboxService: SandboxService;
  }
}
