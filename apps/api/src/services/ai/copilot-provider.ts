/**
 * Copilot SDK AI Provider -- wraps @github/copilot-sdk to implement
 * the LLMRouter and LLMIntentParser interfaces used by the voice pipeline
 * and a new chat completion interface for the chat backend.
 *
 * Architecture: The SDK communicates with the Copilot CLI via JSON-RPC.
 * Each agent gets a dedicated session with a system prompt derived from
 * their squad charter. Supports streaming via event handlers.
 *
 * Config via env vars:
 *   AI_PROVIDER        -- "copilot-sdk" | "mock" (default: "mock")
 *   COPILOT_GITHUB_TOKEN -- GitHub token for Copilot auth (or GH_TOKEN/GITHUB_TOKEN)
 *   COPILOT_MODEL      -- Model to use (default: "gpt-4o")
 */

import { approveAll, CopilotClient } from '@github/copilot-sdk';

import type { LLMIntentParser, ParsedIntent } from '../voice/actions.js';
import type { AgentRoutingProfile, LLMRouter } from '../voice/router.js';

// -- Types -----------------------------------------------------------------

export interface CopilotProviderConfig {
  /** GitHub token for authentication. Falls back to env vars. */
  githubToken?: string;
  /** Model to use (default from COPILOT_MODEL env or "gpt-4o"). */
  model?: string;
  /** Path to the Copilot CLI executable. */
  cliPath?: string;
  /** Working directory for agent tool operations. Defaults to process.cwd(). */
  workingDirectory?: string;
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  messages: ChatCompletionMessage[];
  /** System prompt for the agent. */
  systemPrompt?: string;
  /** Model override for this request. */
  model?: string;
  /** If true, returns chunks via onChunk callback. */
  stream?: boolean;
  /** Callback for streaming chunks. */
  onChunk?: (chunk: string) => void;
  /** Callback for all session events (thinking, tool calls, progress). */
  onEvent?: (event: { type: string; data?: Record<string, unknown> }) => void;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

// -- SDK type stubs --------------------------------------------------------
// These mirror the @github/copilot-sdk API surface. When the SDK is
// installed, these are replaced by the real imports. When running in
// mock mode or if the SDK isn't available, these types still compile.

interface CopilotClientLike {
  start(): Promise<void>;
  stop(): Promise<unknown>;
  createSession(config: Record<string, unknown>): Promise<CopilotSessionLike>;
}

interface CopilotSessionLike {
  on(event: string, handler: (...args: unknown[]) => void): () => void;
  send(options: { prompt: string }): Promise<string>;
  sendAndWait(
    options: { prompt: string },
    timeout?: number,
  ): Promise<{ data?: { content?: string } } | undefined>;
  disconnect(): Promise<void>;
}

// -- Copilot Provider ------------------------------------------------------

export class CopilotProvider implements LLMRouter, LLMIntentParser {
  private client: CopilotClientLike | null = null;
  private readonly config: Required<Pick<CopilotProviderConfig, 'model'>> & CopilotProviderConfig;
  private initialized = false;
  /** Semaphore to limit concurrent session creation. */
  private activeRequests = 0;
  private readonly maxConcurrent = 3;
  private readonly requestQueue: Array<{
    resolve: () => void;
  }> = [];

  constructor(config: CopilotProviderConfig = {}) {
    this.config = {
      ...config,
      model: config.model ?? process.env.COPILOT_MODEL ?? 'claude-sonnet-4',
    };
  }

  // -- Lifecycle -----------------------------------------------------------

  /**
   * Initialize the Copilot SDK client. Must be called before use.
   * Gracefully handles missing SDK package.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const token =
        this.config.githubToken ??
        process.env.COPILOT_GITHUB_TOKEN ??
        process.env.GH_TOKEN ??
        process.env.GITHUB_TOKEN ??
        undefined;

      const clientOpts: Record<string, unknown> = {
        autoStart: false,
      };
      if (token) clientOpts.githubToken = token;
      if (this.config.cliPath) clientOpts.cliPath = this.config.cliPath;

      this.client = new CopilotClient(clientOpts) as unknown as CopilotClientLike;
      await this.client.start();
      this.initialized = true;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Failed to initialize Copilot SDK: ${message}. ` +
          'Ensure @github/copilot-sdk is installed and the Copilot CLI is available.',
      );
    }
  }

  async shutdown(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = null;
      this.initialized = false;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // -- Chat Completion -----------------------------------------------------

  /**
   * Run a chat completion through the Copilot SDK.
   * Supports streaming via onChunk callback.
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    if (!this.client) {
      throw new Error('CopilotProvider not initialized. Call initialize() first.');
    }

    // Wait for a slot if at max concurrency
    await this.acquireSlot();

    const model = options.model ?? this.config.model;
    const prompt = this.buildPrompt(options.messages, options.systemPrompt);

    const sessionConfig: Record<string, unknown> = {
      model,
      onPermissionRequest: approveAll,
      onUserInputRequest: () => ({ response: '' }),
      workingDirectory: this.config.workingDirectory ?? process.cwd(),
    };

    if (options.systemPrompt) {
      sessionConfig.systemMessage = { content: options.systemPrompt };
    }

    let session: CopilotSessionLike | null = null;
    try {
      session = await this.client.createSession(sessionConfig);

      // Subscribe to session events for progress tracking
      if (options.onEvent) {
        const eventCallback = options.onEvent;
        session.on('assistant.intent', (e: unknown) => {
          const ev = e as { type: string; data?: { intent?: string } };
          eventCallback({ type: 'intent', data: { intent: ev.data?.intent } });
        });
        session.on('assistant.reasoning', (e: unknown) => {
          const ev = e as { type: string; data?: { content?: string } };
          eventCallback({ type: 'thinking', data: { content: ev.data?.content } });
        });
        session.on('tool.execution_start', (e: unknown) => {
          const ev = e as { type: string; data?: { name?: string; arguments?: unknown } };
          eventCallback({
            type: 'tool_start',
            data: { name: ev.data?.name, arguments: ev.data?.arguments },
          });
        });
        session.on('session.info', (e: unknown) => {
          const ev = e as { type: string; data?: { message?: string } };
          eventCallback({ type: 'info', data: { message: ev.data?.message } });
        });
        session.on('assistant.message_delta', (e: unknown) => {
          const ev = e as { type: string; data?: { deltaContent?: string } };
          if (ev.data?.deltaContent) {
            eventCallback({ type: 'progress', data: { content: ev.data.deltaContent } });
          }
        });
      }

      if (options.stream && options.onChunk) {
        const content = await this.streamResponse(session, prompt, options.onChunk);
        return { content, model };
      }

      const result = await session.sendAndWait({ prompt }, 3_600_000);
      const content = (result?.data?.content as string) ?? '';
      return { content, model };
    } finally {
      if (session) {
        await session.disconnect().catch(() => {
          /* ok */
        });
      }
      this.releaseSlot();
    }
  }

  private acquireSlot(): Promise<void> {
    if (this.activeRequests < this.maxConcurrent) {
      this.activeRequests++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.requestQueue.push({ resolve });
    });
  }

  private releaseSlot(): void {
    const next = this.requestQueue.shift();
    if (next) {
      next.resolve();
    } else {
      this.activeRequests--;
    }
  }

  // -- LLMRouter interface (voice routing) ---------------------------------

  async route(
    transcript: string,
    agents: AgentRoutingProfile[],
    context: string[],
  ): Promise<{ agentIds: string[]; reason: string }> {
    const agentList = agents
      .map((a) => `- ${a.id} (${a.name}): ${a.role} -- keywords: ${a.keywords.join(', ')}`)
      .join('\n');

    const contextStr = context.length > 0 ? `\nRecent conversation:\n${context.join('\n')}` : '';

    const systemPrompt = [
      'You are a routing classifier for a multi-agent squad.',
      'Given a user transcript, decide which agent(s) should respond.',
      'Available agents:',
      agentList,
      '',
      'Respond with ONLY valid JSON: {"agentIds": ["id1"], "reason": "brief reason"}',
      'Use agent IDs from the list above. Pick 1-2 most relevant agents.',
    ].join('\n');

    const prompt = `${contextStr}\n\nUser said: "${transcript}"\n\nWhich agent(s) should respond?`;

    try {
      const result = await this.chatCompletion({
        systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const parsed = JSON.parse(result.content) as {
        agentIds: string[];
        reason: string;
      };

      const validIds = new Set(agents.map((a) => a.id));
      const filteredIds = parsed.agentIds.filter((id) => validIds.has(id));

      if (filteredIds.length === 0) {
        return {
          agentIds: ['leela'],
          reason: 'No valid agent matched, defaulting to lead',
        };
      }

      return { agentIds: filteredIds, reason: parsed.reason };
    } catch {
      return {
        agentIds: ['leela'],
        reason: 'LLM routing failed, defaulting to lead',
      };
    }
  }

  // -- LLMIntentParser interface (voice actions) ---------------------------

  async parse(transcript: string, context: string[]): Promise<ParsedIntent> {
    const contextStr = context.length > 0 ? `\nRecent conversation:\n${context.join('\n')}` : '';

    const systemPrompt = [
      'You are an intent parser for a squad management voice interface.',
      'Parse the user transcript and identify the action they want to take.',
      '',
      'Valid actions: create_task, assign_task, update_status, prioritize, query_status, query_decisions, unknown',
      '',
      'Respond with ONLY valid JSON:',
      '{"action": "action_type", "confidence": 0.0-1.0, "params": {"key": "value"}}',
      '',
      'For create_task: params should include "title" and optionally "assignee"',
      'For assign_task: params should include "title" and "assignee"',
      'For update_status: params should include "title" and "status"',
      'For prioritize: params should include "title" and "target"',
      'For query_status: params may include "agentId"',
      'For query_decisions: params may include "query"',
    ].join('\n');

    const prompt = `${contextStr}\n\nUser said: "${transcript}"\n\nWhat is the intent?`;

    try {
      const result = await this.chatCompletion({
        systemPrompt,
        messages: [{ role: 'user', content: prompt }],
      });

      const parsed = JSON.parse(result.content) as {
        action: string;
        confidence: number;
        params: Record<string, string>;
      };

      return {
        action: parsed.action as ParsedIntent['action'],
        confidence: parsed.confidence,
        params: parsed.params,
        transcript,
      };
    } catch {
      return { action: 'unknown', confidence: 0, params: {}, transcript };
    }
  }

  // -- Private helpers -----------------------------------------------------

  private buildPrompt(messages: ChatCompletionMessage[], systemPrompt?: string): string {
    const parts: string[] = [];

    if (systemPrompt) {
      parts.push(`[System] ${systemPrompt}`);
    }

    for (const msg of messages) {
      if (msg.role === 'system') {
        parts.push(`[System] ${msg.content}`);
      } else if (msg.role === 'assistant') {
        parts.push(`[Assistant] ${msg.content}`);
      } else {
        parts.push(msg.content);
      }
    }

    return parts.join('\n\n');
  }

  private async streamResponse(
    session: CopilotSessionLike,
    prompt: string,
    onChunk: (chunk: string) => void,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let fullContent = '';

      session.on('assistant.message_delta', (event: unknown) => {
        const delta = (event as { data?: { deltaContent?: string } })?.data?.deltaContent ?? '';
        if (delta) {
          fullContent += delta;
          onChunk(delta);
        }
      });

      session.on('assistant.message', (event: unknown) => {
        const content = (event as { data?: { content?: string } })?.data?.content ?? fullContent;
        resolve(content);
      });

      session.on('error', (error: unknown) => {
        reject(error instanceof Error ? error : new Error(String(error)));
      });

      session.send({ prompt }).catch(reject);
    });
  }
}

// -- Mock Provider ---------------------------------------------------------

/**
 * Mock AI provider with agent-aware responses.
 * Used when AI_PROVIDER=mock (default for local dev) or as automatic
 * fallback when copilot-sdk initialization fails.
 */
export class MockAIProvider implements LLMRouter, LLMIntentParser {
  // Agent personality templates for coordinator-style responses
  private static readonly GREETING: string[] = [
    'Hey there! The squad is online and ready. What are we working on?',
    'Welcome back! Leela, Bender, Fry, and Zoidberg are standing by.',
    'Squad assembled. What do you need from us today?',
  ];
  private static readonly STATUS: string[] = [
    'Let me check with the team. Leela tracks the big picture, Bender handles backend, Fry owns the UI, and Zoidberg keeps quality in check. What specifically do you want a status on?',
    'Everything is running smoothly. Want me to get a specific agent to report in?',
  ];
  private static readonly TASK: string[] = [
    'Got it! I can route that to the right agent. Want me to assign this to Bender (backend), Fry (frontend), or Zoidberg (testing)?',
    'I will create a task for that. Which agent should own it?',
  ];
  private static readonly HELP: string[] = [
    'Here is what I can help with:\n- Chat with the full squad or individual agents\n- Ask about project status or decisions\n- Create and assign tasks\n- Get updates on ongoing work\n\nJust ask naturally and I will route to the right agent!',
  ];
  private static readonly FALLBACK: string[] = [
    'Interesting! Let me think about that. In a real deployment with the Copilot SDK connected, I would give you a much richer answer. For now, I have routed your message to the team.',
    'Good question. The squad is in mock mode right now, but your message has been logged. Once the AI provider is connected, we will have full conversational responses.',
    'Roger that. Your message is noted. The team will see it in the activity feed. For AI-powered responses, configure the Copilot SDK provider.',
  ];

  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const lastMessage = options.messages[options.messages.length - 1];
    const userContent = lastMessage?.content ?? '';
    const lower = userContent.toLowerCase();

    // Pick a contextually relevant response
    let pool: string[];
    if (/\b(hi|hello|hey|good morning|good evening|what'?s up)\b/.test(lower)) {
      pool = MockAIProvider.GREETING;
    } else if (/\b(status|update|progress|how'?s it going|report)\b/.test(lower)) {
      pool = MockAIProvider.STATUS;
    } else if (/\b(task|create|assign|build|implement|fix|add)\b/.test(lower)) {
      pool = MockAIProvider.TASK;
    } else if (/\b(help|what can you|how do i|commands)\b/.test(lower)) {
      pool = MockAIProvider.HELP;
    } else {
      pool = MockAIProvider.FALLBACK;
    }

    const idx = Math.floor(Math.random() * pool.length);
    const response: string = pool[idx] ?? pool[0] ?? '';

    if (options.stream && options.onChunk) {
      const words = response.split(' ');
      for (const word of words) {
        options.onChunk(word + ' ');
      }
    }

    return { content: response, model: 'mock' as const };
  }

  async route(
    transcript: string,
    agents: AgentRoutingProfile[],
    _context: string[],
  ): Promise<{ agentIds: string[]; reason: string }> {
    const lower = transcript.toLowerCase();
    for (const agent of agents) {
      if (lower.includes(agent.name.toLowerCase())) {
        return {
          agentIds: [agent.id],
          reason: `Mock: matched agent name ${agent.name}`,
        };
      }
    }
    return {
      agentIds: [agents[0]?.id ?? 'leela'],
      reason: 'Mock: default to first agent',
    };
  }

  async parse(transcript: string, _context: string[]): Promise<ParsedIntent> {
    return { action: 'unknown', confidence: 0, params: {}, transcript };
  }
}

// -- Factory ---------------------------------------------------------------

export type AIProviderType = 'copilot-sdk' | 'mock';

export interface AIProvider {
  chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult>;
  route: LLMRouter['route'];
  parse: LLMIntentParser['parse'];
}

/**
 * Create the appropriate AI provider based on config.
 * Falls back to MockAIProvider when copilot-sdk cannot initialize.
 *
 * @param type - Provider type (reads AI_PROVIDER env if not specified)
 * @param config - Provider-specific configuration
 */
export async function createAIProvider(
  type?: AIProviderType,
  config?: CopilotProviderConfig,
): Promise<AIProvider> {
  const providerType = type ?? (process.env.AI_PROVIDER as AIProviderType) ?? 'copilot-sdk';

  if (providerType === 'copilot-sdk') {
    try {
      const provider = new CopilotProvider(config);
      await provider.initialize();
      return provider;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[AI] copilot-sdk initialization failed, falling back to mock provider: ${message}`,
      );
      return new MockAIProvider();
    }
  }

  return new MockAIProvider();
}
