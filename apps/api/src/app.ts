import { resolve } from 'node:path';

import cors from '@fastify/cors';
import { mcpPlugin } from '@matanelcohen/openspace-mcp-server';
import type { AgentCapability } from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';
import Fastify, { type FastifyServerOptions } from 'fastify';

import { ErrorCodes, sendError } from './lib/api-errors.js';
import { migrateTaskStatuses } from './services/migrations/migrate-task-statuses.js';
import a2aRoute from './routes/a2a.js';
import activityRoute from './routes/activity.js';
import agentsRoute from './routes/agents.js';
import channelsRoute from './routes/channels.js';
import chatRoute from './routes/chat.js';
import costsRoute from './routes/costs.js';
import cronRoute from './routes/cron.js';
import decisionsRoute from './routes/decisions.js';
import githubRoute from './routes/github.js';
import healthRoute from './routes/health.js';
import knowledgeRoute from './routes/knowledge.js';
import memoriesRoute from './routes/memories.js';
import otlpCollectorRoute from './routes/otlp-collector.js';
import sandboxesRoute from './routes/sandboxes.js';
import skillsRoute from './routes/skills.js';
import skillGalleryRoute from './routes/skill-gallery.js';
import squadRoute from './routes/squad.js';
import tasksRoute from './routes/tasks.js';
import teamMembersRoute from './routes/team-members.js';
import terminalRoute from './routes/terminal.js';
import tracesRoute from './routes/traces.js';
import voiceRoute from './routes/voice.js';
import workspacesRoute from './routes/workspaces.js';
import worktreesRoute from './routes/worktrees.js';
import yoloRoute from './routes/yolo.js';
import escalationsRoute from './routes/escalations.js';
import type { A2AService } from './services/a2a/index.js';
import { createA2AService } from './services/a2a/index.js';
import { ActivityFeed } from './services/activity/index.js';
import { AgentRegistry } from './services/agent-registry.js';
import { AgentWorkerService } from './services/agent-worker/index.js';
import type { AIProvider } from './services/ai/copilot-provider.js';
import { createAIProvider } from './services/ai/copilot-provider.js';
import { AuthService } from './services/auth/index.js';
import { ChatService } from './services/chat/index.js';
import { CostService } from './services/cost/index.js';
import { loadSquadConfig } from './services/config/index.js';
import { CronService } from './services/cron/index.js';
import { openDatabase } from './services/db/index.js';
import { seedTeamMembers, syncTeamMembers } from './services/db/seed-team.js';
import { buildHookPipeline, type HookPipeline } from './services/hooks/pipeline.js';
import { SandboxService } from './services/sandbox/index.js';
import { KnowledgeSearchService } from './services/search/index.js';
import { seedBuiltinSkills } from './services/seed-skills.js';
import { SkillRegistryImpl } from './services/skill-registry/index.js';
import { SkillGalleryService } from './services/skill-gallery/index.js';
import { SquadParser } from './services/squad-parser/index.js';
import { TraceService } from './services/traces/index.js';
import { MemoryLifecycleService } from './services/memory/memory-lifecycle.js';
import {
  ConversationContextManager,
  VoiceRouter,
  VoiceSessionManager,
} from './services/voice/index.js';
import type { WebSocketManager } from './services/websocket/index.js';
import { wsPlugin } from './services/websocket/index.js';
import { WorkspaceService } from './services/workspace/index.js';
import { WorktreeService } from './services/worktree/index.js';
import { YoloService } from './services/yolo/index.js';

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

export async function buildApp(opts: AppOptions = {}) {
  const app = Fastify({
    logger: opts.logger ?? true,
  });

  // Workspace service (global, stored in ~/.openspace/workspaces.json)
  const workspaceService = new WorkspaceService();
  const defaultSquadDir = opts.squadDir ?? resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
  workspaceService.autoRegister(resolve(defaultSquadDir, '..'));

  // Use stored active workspace's squadDir if available, otherwise default
  const activeWsOnStartup = workspaceService.getActive();
  const squadDir = activeWsOnStartup?.squadDir ?? defaultSquadDir;

  const db = opts.db ?? openDatabase({ squadDir });

  // Run RAG tables migration
  try {
    const { migration_v3 } = await import('./services/ingestion/migration-v3.js');
    migration_v3(db);
  } catch { /* best effort */ }

  // Seed team members from .squad/team.md
  syncTeamMembers(db, squadDir);

  // Decorate with a SquadParser instance
  const parser = new SquadParser(squadDir);
  app.decorate('squadParser', parser);

  app.decorate('workspaceService', workspaceService);

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

  // Agent registry — dynamic roster loaded from team_members table
  const agentRegistry = new AgentRegistry(db);
  agentRegistry.loadFromDatabase();
  app.decorate('agentRegistry', agentRegistry);
  chatService.setAgentRegistry(agentRegistry);

  // Set initial workspace ID on chat service
  {
    const activeWs = workspaceService.getActive();
    if (activeWs) chatService.setWorkspaceId(activeWs.id);
  }

  // Auth service
  const authService = new AuthService({ db });
  app.decorate('authService', authService);

  // Skill registry
  const skillRegistry = new SkillRegistryImpl();
  seedBuiltinSkills(skillRegistry, squadDir);
  app.decorate('skillRegistry', skillRegistry);

  // Skill gallery (catalog for browse/search/install)
  const skillGalleryService = new SkillGalleryService(db, () => {
    const ids = new Set<string>();
    for (const entry of skillRegistry.list()) {
      ids.add(entry.manifest.id);
    }
    return ids;
  });
  skillGalleryService.seed();
  app.decorate('skillGalleryService', skillGalleryService);

  // Cron scheduler
  const cronService = new CronService({ squadDir });
  cronService.setChatService(chatService);
  app.decorate('cronService', cronService);

  // Knowledge search service with local embedder
  let knowledgeEmbedder: import('@matanelcohen/openspace-shared').Embedder | undefined;
  try {
    const mod = await (import('./services/embeddings/local-embedder.js') as Promise<{ LocalEmbedder: new () => import('@matanelcohen/openspace-shared').Embedder }>);
    knowledgeEmbedder = new mod.LocalEmbedder();
    console.log('[Knowledge] Local embedder initialized (lazy load on first query)');
  } catch (e) {
    console.log(`[Knowledge] Local embedder not available — keyword search only: ${(e as Error).message}`);
  }
  const knowledgeSearch = new KnowledgeSearchService({ db, embedder: knowledgeEmbedder });
  app.decorate('knowledgeSearch', knowledgeSearch);

  // Sandbox service (Docker container management)
  const sandboxService = new SandboxService();
  app.decorate('sandboxService', sandboxService);

  // Voice services — agent profiles loaded from config or defaults
  const DEFAULT_AGENT_PROFILES = [
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

  // Will be replaced by config-driven profiles in onReady
  let AGENT_PROFILES = DEFAULT_AGENT_PROFILES;

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

    // Start sandbox pool warmup + idle cleanup
    sandboxService.start().catch((err) => console.error('[Sandbox] Start failed:', err));

    // Wire WebSocket chat:send messages through ChatService.send()
    // which validates channel membership before persisting or broadcasting.
    app.wsManager.setChatSendHandler(async (input) => {
      await chatService.send(input);
    });

    // Load squad.config.ts (optional) and derive agent profiles from it
    const squadConfig = await loadSquadConfig({
      rootDir: resolve(squadDir, '..'),
      squadDir,
    });

    if (squadConfig) {
      const PERSONALITY_MAP: Record<string, string> = {
        Lead: 'Strategic, decisive, direct. Keeps the team focused on what matters.',
        'Frontend Dev': 'Enthusiastic, creative, friendly. Loves building beautiful UIs.',
        'Backend Dev': 'Blunt, efficient, matter-of-fact. Gets things done with minimal fuss.',
        Tester: 'Methodical, thorough, precise. Finds edge cases others miss.',
      };

      AGENT_PROFILES = squadConfig.agents.map((a) => ({
        id: a.name,
        name: a.name.charAt(0).toUpperCase() + a.name.slice(1),
        role: a.role,
        personality: PERSONALITY_MAP[a.role] ?? 'Professional, collaborative, dedicated.',
      }));
      voiceServices.chatAgents = AGENT_PROFILES;

      // Wire capabilities from config into SquadParser so /api/agents returns them
      const capMap = new Map<string, AgentCapability[]>();
      for (const agentDef of squadConfig.agents) {
        if (agentDef.capabilities?.length) {
          capMap.set(agentDef.name, agentDef.capabilities);
        }
      }
      if (capMap.size > 0) {
        parser.setCapabilities(capMap);
        console.log(`[Config] Loaded capabilities for ${capMap.size} agents`);
      }

      // Wire routing rules from config into ChatService
      if (squadConfig.routing?.rules?.length) {
        chatService.setRoutingRules(squadConfig.routing.rules);
        console.log(`[Config] Loaded ${squadConfig.routing.rules.length} routing rules`);
      }

      // Wire hooks from config into a HookPipeline
      if (squadConfig.hooks) {
        const hookPipeline = buildHookPipeline(squadConfig.hooks);
        app.decorate('hookPipeline', hookPipeline);
        console.log('[Config] Loaded governance hooks (FileGuard, ShellRestriction, RateLimit)');
      }

      // Wire ceremonies from config into CronService
      if (squadConfig.ceremonies?.length) {
        cronService.loadCeremonies(squadConfig.ceremonies);
        console.log(`[Config] Loaded ${squadConfig.ceremonies.length} ceremony definitions`);
      }
    }

    // Initialize AI provider and connect to chat + voice + worker services
    if (!opts.aiProvider) {
      let provider;
      try {
        provider = await createAIProvider(undefined, {
          workingDirectory: resolve(squadDir, '..'),
          traceService,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`\n❌ AI Provider not available: ${msg}`);
        console.error('   Start the Copilot CLI server: agency copilot --headless --port 3100');
        console.error('   Or use: openspace (which starts it automatically)\n');
        
        // Broadcast error to connected clients
        if (app.wsManager) {
          app.wsManager.broadcast(JSON.stringify({
            type: 'system:error',
            error: 'AI provider not connected. Start the Copilot CLI server to enable agent execution.',
          }));
        }
        // Continue without AI — API still serves UI, workspaces, tasks, etc.
        // But agent execution and chat AI responses won't work.
        return app;
      }
      chatService.setAIProvider(provider);
      voiceServices.aiProvider = provider;
      voiceServices.router = new VoiceRouter({ llmRouter: provider });

      // Compute A2A base URL (shared by worker delegation + A2A service)
      const port = Number(process.env.PORT) || 3001;
      const host = process.env.HOST || 'localhost';
      const a2aBaseUrl = process.env.A2A_BASE_URL || `http://${host}:${port}`;

      // Initialize WorktreeService for sandboxed parallel agent execution
      const projectDir = resolve(squadDir, '..');
      const sandboxCfg = squadConfig?.sandbox;
      const worktreeService = new WorktreeService({
        projectDir,
        baseBranch: sandboxCfg?.baseBranch ?? process.env.WORKTREE_BASE_BRANCH ?? 'main',
        maxWorktrees: sandboxCfg?.maxWorktrees ?? (Number(process.env.WORKTREE_MAX) || 10),
        worktreeDir: sandboxCfg?.worktreeDir ?? '.git-worktrees',
        symlinkSquad: true,
        autoCommit: sandboxCfg?.autoCommit ?? process.env.WORKTREE_AUTO_COMMIT !== 'false',
        autoPR: sandboxCfg?.autoPR ?? process.env.WORKTREE_AUTO_PR !== 'false',
      });
      worktreeService.init();
      app.decorate('worktreeService', worktreeService);

      // Start agent worker service with A2A delegation capability
      const workerService = new AgentWorkerService({
        tasksDir: resolve(squadDir, 'tasks'),
        squadDir,
        aiProvider: provider,
        activityFeed,
        wsManager: app.wsManager ?? null,
        agents: AGENT_PROFILES,
        db,
        a2aBaseUrl,
        worktreeService,
      });
      // Start worker in background — don't block onReady hook
      workerService.start().then(async () => {
        // After recovery, clean up worktrees for done/blocked tasks
        await worktreeService.cleanupDoneTasks((taskId) => {
          try {
            const { readFileSync } = require('node:fs');
            const { join } = require('node:path');
            const content = readFileSync(join(resolve(squadDir, 'tasks'), `${taskId}.md`), 'utf-8');
            const match = content.match(/^status:\s*(.+)$/m);
            return match?.[1]?.trim() ?? null;
          } catch { return null; }
        });
      }).catch((err) => console.error('[AgentWorker] Start failed:', err));
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

      // YOLO Mode service — autonomous task triage
      const yoloService = new YoloService({
        aiProvider: provider,
        agentWorker: workerService,
        squadParser: parser,
        tasksDir: resolve(squadDir, 'tasks'),
        wsManager: app.wsManager ?? null,
      });
      app.decorate('yoloService', yoloService);

      // Shut down worker + YOLO on close
      app.addHook('onClose', async () => {
        yoloService.stop();
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

    // Start cron scheduler
    cronService.start();

    // Start memory lifecycle (daily decay + consolidation)
    const memoryLifecycle = new MemoryLifecycleService(db, {
      intervalMs: 24 * 60 * 60 * 1000, // 24h
      archiveThreshold: 0.1,
      runOnStart: true,
    });
    memoryLifecycle.start();
    app.decorate('memoryLifecycle', memoryLifecycle);

    // Migrate legacy task statuses (backlog/in-review/pending-approval → new statuses)
    // Migrate legacy task statuses in background
    migrateTaskStatuses(resolve(squadDir, 'tasks')).catch(() => {});
  });

  // Cost service — derives spend from trace + span data
  const costService = new CostService(db);
  app.decorate('costService', costService);

  // Trace service for recording AI interactions
  const traceService = new TraceService(db);
  // Set initial workspace ID from auto-registered workspace
  const activeWs = workspaceService.getActive();
  if (activeWs) traceService.setWorkspaceId(activeWs.id);
  app.decorate('traceService', traceService);

  // Escalation service + migration
  try {
    const { migration_v4 } = await import('./services/escalation/migration-v4.js');
    migration_v4(db);
    const { EscalationService } = await import('./services/escalation/index.js');
    const escalationService = new EscalationService(db);
    app.decorate('escalationService', escalationService);
  } catch (err) {
    console.warn(`[Escalation] Service init failed: ${(err as Error).message}`);
  }

  // Decorate Fastify instance with the SQLite database
  app.decorate('db', db);

  // Shut down sandbox containers, cron, and memory lifecycle on app close
  app.addHook('onClose', async () => {
    cronService.stop();
    if ((app as unknown as Record<string, unknown>).memoryLifecycle) {
      (app as unknown as { memoryLifecycle: MemoryLifecycleService }).memoryLifecycle.stop();
    }
    await sandboxService.shutdown();
  });

  // Routes
  app.register(healthRoute);
  app.register(healthRoute, { prefix: '/api' });
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
  app.register(memoriesRoute, { prefix: '/api' });
  app.register(teamMembersRoute, { prefix: '/api' });
  app.register(sandboxesRoute, { prefix: '/api' });
  app.register(tracesRoute, { prefix: '/api' });
  app.register(costsRoute, { prefix: '/api' });
  app.register(skillsRoute, { prefix: '/api' });
  app.register(skillGalleryRoute, { prefix: '/api' });
  app.register(cronRoute, { prefix: '/api' });
  app.register(workspacesRoute, { prefix: '/api' });
  app.register(worktreesRoute);
  app.register(yoloRoute, { prefix: '/api' });
  app.register(githubRoute, { prefix: '/api' });
  app.register(escalationsRoute, { prefix: '/api' });
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
    yoloService?: YoloService;
    sandboxService: SandboxService;
    hookPipeline?: HookPipeline;
    agentRegistry: AgentRegistry;
    escalationService?: import('./services/escalation/index.js').EscalationService;
  }
}
