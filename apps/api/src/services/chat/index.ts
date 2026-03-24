/**
 * Chat service (P3-4) — message CRUD, dual persistence, WebSocket emission.
 *
 * Persists chat messages to:
 *   1. SQLite chat_messages table (fast queries)
 *   2. `.squad/sessions/` markdown files (squad memory)
 *
 * Routes team messages through a simple Coordinator stub (echo-back).
 */

import { existsSync, mkdirSync } from 'node:fs';
import { appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { ChatMessage } from '@openspace/shared';
import { CHAT_TEAM_RECIPIENT } from '@openspace/shared';
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

import type { ActivityFeed } from '../activity/index.js';
import type { AIProvider } from '../ai/copilot-provider.js';
import type { WebSocketManager, WsEnvelope } from '../websocket/index.js';

// ── Types ─────────────────────────────────────────────────────────

export interface SendMessageInput {
  sender: string;
  recipient: string;
  content: string;
  threadId?: string | null;
}

export interface GetMessagesOptions {
  limit?: number;
  offset?: number;
  /** Filter by sender or recipient matching this agent ID. */
  agent?: string;
  /** Filter by thread ID. */
  threadId?: string;
}

// ── Chat Service ──────────────────────────────────────────────────

export class ChatService {
  private readonly db: Database.Database | null;
  private readonly sessionsDir: string | null;
  private wsManager: WebSocketManager | null = null;
  private aiProvider: AIProvider | null = null;
  private activityFeed: ActivityFeed | null = null;

  constructor(opts: {
    db?: Database.Database | null;
    /** .squad/sessions/ directory for markdown logs. */
    sessionsDir?: string | null;
    /** AI provider for generating agent responses. */
    aiProvider?: AIProvider | null;
  }) {
    this.db = opts.db ?? null;
    this.sessionsDir = opts.sessionsDir ?? null;
    this.aiProvider = opts.aiProvider ?? null;

    if (this.sessionsDir && !existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /** Connect to a WebSocket manager for broadcasting chat events. */
  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
  }

  /** Set the AI provider for generating agent responses. */
  setAIProvider(provider: AIProvider): void {
    this.aiProvider = provider;
  }

  /** Connect to the activity feed for cross-system event publishing. */
  setActivityFeed(feed: ActivityFeed): void {
    this.activityFeed = feed;
  }

  // ── Send message ────────────────────────────────────────────

  /**
   * Send a message: persist to both stores, emit via WebSocket,
   * and if it's a team message, generate a coordinator echo response.
   */
  async send(input: SendMessageInput): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: nanoid(12),
      sender: input.sender,
      recipient: input.recipient,
      content: input.content,
      timestamp: new Date().toISOString(),
      threadId: input.threadId ?? null,
    };

    // Dual write
    this.persistToSqlite(message);
    await this.persistToMarkdown(message);

    // Broadcast via WebSocket
    this.emitChatMessage(message);

    // Route to agents — team messages go through routing, direct messages go to the specific agent
    if (input.recipient === CHAT_TEAM_RECIPIENT) {
      this.coordinatorEcho(message).catch((err) => {
        console.error('[Chat] coordinatorEcho failed:', err);
      });
    } else {
      // Direct message to a specific agent
      const agent = ChatService.AGENTS.find((a) => a.id === input.recipient);
      if (agent && this.aiProvider) {
        this.handleDirectMessage(agent, message).catch((err) => {
          console.error(`[Chat] Direct message to ${agent.name} failed:`, err);
        });
      }
    }

    return message;
  }

  // ── Get messages ────────────────────────────────────────────

  /** Retrieve paginated message history. */
  getMessages(opts: GetMessagesOptions = {}): { messages: ChatMessage[]; total: number } {
    if (!this.db) {
      return { messages: [], total: 0 };
    }

    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    let whereClause = '';
    const params: Record<string, string> = {};

    const conditions: string[] = [];

    if (opts.agent) {
      conditions.push('(sender = @agent OR recipient = @agent)');
      params.agent = opts.agent;
    }

    if (opts.threadId) {
      conditions.push('thread_id = @threadId');
      params.threadId = opts.threadId;
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }

    const countSql = `SELECT COUNT(*) as total FROM chat_messages ${whereClause}`;
    const totalRow = this.db.prepare(countSql).get(params) as { total: number };

    const querySql = `SELECT * FROM chat_messages ${whereClause} ORDER BY timestamp ASC LIMIT @limit OFFSET @offset`;
    const rows = this.db.prepare(querySql).all({ ...params, limit, offset }) as Array<{
      id: string;
      sender: string;
      recipient: string;
      content: string;
      timestamp: string;
      thread_id: string | null;
    }>;

    const messages: ChatMessage[] = rows.map((r) => ({
      id: r.id,
      sender: r.sender,
      recipient: r.recipient,
      content: r.content,
      timestamp: r.timestamp,
      threadId: r.thread_id,
    }));

    return { messages, total: totalRow.total };
  }

  /** Get a single message by ID. */
  getMessage(id: string): ChatMessage | null {
    if (!this.db) return null;

    const row = this.db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as
      | {
          id: string;
          sender: string;
          recipient: string;
          content: string;
          timestamp: string;
          thread_id: string | null;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      sender: row.sender,
      recipient: row.recipient,
      content: row.content,
      timestamp: row.timestamp,
      threadId: row.thread_id,
    };
  }

  // ── Private: Persistence ──────────────────────────────────────

  private persistToSqlite(msg: ChatMessage): void {
    if (!this.db) return;

    this.db
      .prepare(
        `INSERT INTO chat_messages (id, sender, recipient, content, timestamp, thread_id)
         VALUES (@id, @sender, @recipient, @content, @timestamp, @threadId)`,
      )
      .run({
        id: msg.id,
        sender: msg.sender,
        recipient: msg.recipient,
        content: msg.content,
        timestamp: msg.timestamp,
        threadId: msg.threadId,
      });
  }

  private async persistToMarkdown(msg: ChatMessage): Promise<void> {
    if (!this.sessionsDir) return;

    // One markdown file per day
    const dateStr = msg.timestamp.slice(0, 10); // YYYY-MM-DD
    const filePath = join(this.sessionsDir, `chat-${dateStr}.md`);

    const line = `\n**[${msg.timestamp}] ${msg.sender} → ${msg.recipient}:** ${msg.content}\n`;

    try {
      if (existsSync(filePath)) {
        await appendFile(filePath, line, 'utf-8');
      } else {
        const header = `# Chat Log — ${dateStr}\n`;
        await writeFile(filePath, header + line, 'utf-8');
      }
    } catch {
      // Best-effort: don't crash if markdown write fails
    }
  }

  // ── Private: WebSocket emission ───────────────────────────────

  private emitChatMessage(msg: ChatMessage): void {
    if (!this.wsManager) return;

    const envelope: WsEnvelope = {
      type: 'chat:message',
      payload: msg as unknown as Record<string, unknown>,
      timestamp: msg.timestamp,
    };

    this.wsManager.broadcast(envelope);
  }

  private emitTyping(agentId: string, agentName: string): void {
    if (!this.wsManager) return;

    this.wsManager.broadcast({
      type: 'chat:typing',
      payload: { agentId, agentName, isTyping: true },
      timestamp: new Date().toISOString(),
    });
  }

  private emitTypingStop(agentId: string): void {
    if (!this.wsManager) return;

    this.wsManager.broadcast({
      type: 'chat:typing',
      payload: { agentId, isTyping: false },
      timestamp: new Date().toISOString(),
    });
  }

  /** Emit an activity event when an agent responds in chat (Chat→Activity bridge). */
  private emitChatActivity(agentId: string, description: string): void {
    if (!this.activityFeed) return;

    try {
      this.activityFeed.push({
        id: `act-chat-${Date.now()}-${agentId}`,
        type: 'completed',
        agentId,
        description,
        timestamp: new Date().toISOString(),
        relatedEntityId: null,
      });
    } catch {
      // Best-effort — don't break chat if activity feed fails
    }
  }

  // ── Private: Agent responses ──────────────────────────────────

  /** Agent definitions for routing and personality. */
  private static readonly AGENTS = [
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
  ] as const;

  /**
   * Route a team message to relevant agents. Each agent responds
   * individually as a separate chat message sent via WebSocket.
   */
  private async coordinatorEcho(original: ChatMessage): Promise<ChatMessage> {
    if (this.aiProvider) {
      try {
        // First, determine which agents should respond
        const agentIds = await this.routeToAgents(original.content);
        const respondingAgents = ChatService.AGENTS.filter((a) => agentIds.includes(a.id));

        // Generate responses individually — don't let one failure kill all
        const responses: ChatMessage[] = [];
        for (const agent of respondingAgents) {
          try {
            this.emitTyping(agent.id, agent.name);
            const response = await this.generateAgentResponse(agent, original);
            this.emitTypingStop(agent.id);
            this.persistToSqlite(response);
            await this.persistToMarkdown(response);
            this.emitChatMessage(response);
            this.emitChatActivity(agent.id, `${agent.name} responded in chat`);
            responses.push(response);
          } catch (err) {
            this.emitTypingStop(agent.id);
            console.error(`[Chat] ${agent.name} failed to respond:`, err);
          }
        }

        if (responses.length > 0) {
          return responses[responses.length - 1]!;
        }
      } catch (err) {
        console.error('[Chat] Agent routing failed:', err);
      }
    }

    // Fallback: simple echo from Leela
    const echo: ChatMessage = {
      id: nanoid(12),
      sender: 'leela',
      recipient: CHAT_TEAM_RECIPIENT,
      content: 'The squad is here but the AI provider is not connected. Check the server logs.',
      timestamp: new Date().toISOString(),
      threadId: original.threadId,
    };

    this.persistToSqlite(echo);
    await this.persistToMarkdown(echo);
    this.emitChatMessage(echo);

    return echo;
  }

  /** Determine which agents should respond. Direct name match first, then LLM routing. */
  private async routeToAgents(content: string): Promise<string[]> {
    const lower = content.toLowerCase();

    // "team", "everyone", "each one", "all of you", "squad" → all agents
    if (/\b(team|everyone|each one|all of you|all agents|squad|everybody)\b/.test(lower)) {
      return ChatService.AGENTS.map((a) => a.id);
    }

    // Direct name match — if the user mentions an agent by name, route to them
    const mentioned = ChatService.AGENTS.filter(
      (a) => lower.includes(a.name.toLowerCase()) || lower.includes(a.id),
    );
    if (mentioned.length > 0) {
      return mentioned.map((a) => a.id);
    }

    // No name mentioned — try LLM routing, fallback to all agents
    if (!this.aiProvider) return ChatService.AGENTS.map((a) => a.id);

    try {
      const profiles = ChatService.AGENTS.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        keywords: [a.role.toLowerCase(), a.id],
      }));

      const result = await this.aiProvider.route(content, profiles, []);
      return result.agentIds.length > 0 ? result.agentIds : ChatService.AGENTS.map((a) => a.id);
    } catch {
      return ChatService.AGENTS.map((a) => a.id);
    }
  }

  /** Generate a single agent's response with their personality. */
  private async generateAgentResponse(
    agent: { id: string; name: string; role: string; personality: string },
    original: ChatMessage,
  ): Promise<ChatMessage> {
    const result = await this.aiProvider!.chatCompletion({
      systemPrompt:
        `You are ${agent.name}, the ${agent.role} of the openspace.ai squad. ` +
        `Personality: ${agent.personality} ` +
        `Respond in character as ${agent.name}. Keep responses concise (2-4 sentences). ` +
        `IMPORTANT: Only speak for yourself. Never speak on behalf of other agents or summarize what they did. ` +
        `Other agents will respond separately in their own messages. ` +
        `Never prefix your response with your name or any other agent's name — the UI handles that.`,
      messages: [{ role: 'user', content: original.content }],
    });

    return {
      id: nanoid(12),
      sender: agent.id,
      recipient: CHAT_TEAM_RECIPIENT,
      content: result.content,
      timestamp: new Date().toISOString(),
      threadId: original.threadId,
    };
  }

  /** Handle a direct message to a specific agent. */
  private async handleDirectMessage(
    agent: { id: string; name: string; role: string; personality: string },
    original: ChatMessage,
  ): Promise<void> {
    try {
      this.emitTyping(agent.id, agent.name);

      const result = await this.aiProvider!.chatCompletion({
        systemPrompt:
          `You are ${agent.name}, the ${agent.role} of the openspace.ai squad. ` +
          `Personality: ${agent.personality} ` +
          `The user is talking directly to you. Respond in character as ${agent.name}. ` +
          `You can and should take action on requests — create files, write code, run commands. ` +
          `If the user asks you to do something, do it. Don't just talk about it. ` +
          `Never prefix your response with your name — the UI handles that.`,
        messages: [{ role: 'user', content: original.content }],
      });

      this.emitTypingStop(agent.id);

      const response: ChatMessage = {
        id: nanoid(12),
        sender: agent.id,
        recipient: agent.id,
        content: result.content,
        timestamp: new Date().toISOString(),
        threadId: original.threadId,
      };

      this.persistToSqlite(response);
      await this.persistToMarkdown(response);
      this.emitChatMessage(response);
      this.emitChatActivity(agent.id, `${agent.name} responded to direct message`);
    } catch (err) {
      this.emitTypingStop(agent.id);
      console.error(`[Chat] ${agent.name} direct message failed:`, err);
    }
  }
}
