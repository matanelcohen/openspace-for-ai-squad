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

  constructor(opts: {
    db?: Database.Database | null;
    /** .squad/sessions/ directory for markdown logs. */
    sessionsDir?: string | null;
  }) {
    this.db = opts.db ?? null;
    this.sessionsDir = opts.sessionsDir ?? null;

    if (this.sessionsDir && !existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  /** Connect to a WebSocket manager for broadcasting chat events. */
  setWebSocketManager(wsManager: WebSocketManager): void {
    this.wsManager = wsManager;
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

    // If team message → coordinator echo (stub for now)
    if (input.recipient === CHAT_TEAM_RECIPIENT) {
      const echo = await this.coordinatorEcho(message);
      return echo; // return the echo as the "response" 
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

    const querySql = `SELECT * FROM chat_messages ${whereClause} ORDER BY timestamp DESC LIMIT @limit OFFSET @offset`;
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

    const row = this.db.prepare('SELECT * FROM chat_messages WHERE id = ?').get(id) as {
      id: string;
      sender: string;
      recipient: string;
      content: string;
      timestamp: string;
      thread_id: string | null;
    } | undefined;

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

  // ── Private: Coordinator stub ─────────────────────────────────

  /**
   * Simple coordinator echo: when a team message arrives, echo it back
   * with a coordinator/agent response. In the future this will route to
   * actual AI agents via copilot-sdk.
   */
  private async coordinatorEcho(original: ChatMessage): Promise<ChatMessage> {
    const echo: ChatMessage = {
      id: nanoid(12),
      sender: 'coordinator',
      recipient: original.sender,
      content: `[Coordinator] Received your message: "${original.content}". Routing to the team…`,
      timestamp: new Date().toISOString(),
      threadId: original.threadId,
    };

    this.persistToSqlite(echo);
    await this.persistToMarkdown(echo);
    this.emitChatMessage(echo);

    return echo;
  }
}
