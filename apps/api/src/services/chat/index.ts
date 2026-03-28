/**
 * Chat service (P3-4) — message CRUD, dual persistence, WebSocket emission.
 *
 * Persists chat messages to:
 *   1. SQLite chat_messages table (fast queries)
 *   2. `.squad/sessions/` markdown files (squad memory)
 *
 * Routes team messages through a simple Coordinator stub (echo-back).
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { appendFile, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import type { ChatChannel, ChatMessage, RoutingRule } from '@openspace/shared';
import { CHAT_CHANNEL_PREFIX, CHAT_TEAM_RECIPIENT } from '@openspace/shared';
import type Database from 'better-sqlite3';
import { nanoid } from 'nanoid';

import type { ActivityFeed } from '../activity/index.js';
import type { AgentRegistry } from '../agent-registry.js';
import type { AIProvider } from '../ai/copilot-provider.js';
import {
  buildSkillsPrompt,
  getSkillsForRole,
  loadSkillsFromDirectory,
  type ParsedSkill,
} from '../seed-skills.js';
import {
  createChannel as writeChannelFile,
  deleteChannel as deleteChannelFile,
  updateChannel as updateChannelFile,
} from '../squad-writer/channel-writer.js';
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

/** SSE chunk emitted during streaming chat responses. */
export interface StreamEvent {
  agentId: string;
  chunk: string;
  done: boolean;
  fullContent?: string;
}

// ── Channel Validation ────────────────────────────────────────────

export type ChannelValidationCode = 'DUPLICATE_NAME' | 'NAME_REQUIRED' | 'EMPTY_MEMBER_LIST';

/**
 * Thrown by channel CRUD methods when input validation fails.
 * Route handlers catch this and map `code` to the appropriate HTTP status.
 */
export class ChannelValidationError extends Error {
  public readonly code: ChannelValidationCode;

  constructor(code: ChannelValidationCode, message: string) {
    super(message);
    this.name = 'ChannelValidationError';
    this.code = code;
  }
}

// ── Channel Membership Validation ─────────────────────────────────

export type ChannelMembershipCode = 'CHANNEL_NOT_FOUND' | 'NOT_A_MEMBER';

/**
 * Thrown when a sender attempts to send a message to a channel they
 * don't belong to, or when the target channel doesn't exist.
 * Security-critical — prevents message leaks to non-members.
 */
export class ChannelMembershipError extends Error {
  public readonly code: ChannelMembershipCode;

  constructor(code: ChannelMembershipCode, message: string) {
    super(message);
    this.name = 'ChannelMembershipError';
    this.code = code;
  }
}

/** Result from deleteChannel, includes count of cleaned-up messages. */
export interface DeleteChannelResult {
  deleted: boolean;
  deletedMessages: number;
}

// ── Chat Service ──────────────────────────────────────────────────

export class ChatService {
  private readonly db: Database.Database | null;
  private readonly sessionsDir: string | null;
  private readonly channelsDir: string | null;
  private wsManager: WebSocketManager | null = null;
  private aiProvider: AIProvider | null = null;
  private activityFeed: ActivityFeed | null = null;
  private readonly allSkills: ParsedSkill[];
  private routingRules: RoutingRule[] = [];
  private workspaceId = '';
  private agentRegistry: AgentRegistry | null = null;

  constructor(opts: {
    db?: Database.Database | null;
    /** .squad/sessions/ directory for markdown logs. */
    sessionsDir?: string | null;
    /** .squad/channels/ directory for channel file persistence. */
    channelsDir?: string | null;
    /** AI provider for generating agent responses. */
    aiProvider?: AIProvider | null;
  }) {
    this.db = opts.db ?? null;
    this.sessionsDir = opts.sessionsDir ?? null;
    this.channelsDir = opts.channelsDir ?? null;
    this.aiProvider = opts.aiProvider ?? null;

    if (this.sessionsDir && !existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }

    // Ensure workspace_id column exists (safe migration)
    if (this.db) {
      try {
        this.db.exec("ALTER TABLE chat_messages ADD COLUMN workspace_id TEXT DEFAULT ''");
      } catch { /* column already exists */ }
    }

    // Load skills from .squad/skills/ for per-agent filtering
    const squadDir = resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
    this.allSkills = loadSkillsFromDirectory(join(squadDir, 'skills'));
  }

  /** Get the skills prompt fragment for a given agent role. */
  private getSkillsPromptForAgent(role: string): string {
    const matched = getSkillsForRole(this.allSkills, role);
    return buildSkillsPrompt(matched);
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

  /** Set the active workspace ID — chat messages are scoped per workspace. */
  setWorkspaceId(id: string): void {
    this.workspaceId = id;
  }

  /** Set the agent registry for dynamic agent lookups. */
  setAgentRegistry(registry: AgentRegistry): void {
    this.agentRegistry = registry;
  }

  /** Get the current agent list from the registry, falling back to FALLBACK_AGENTS. */
  private getAgents(): ReadonlyArray<{ id: string; name: string; role: string; personality: string }> {
    if (this.agentRegistry) {
      const agents = this.agentRegistry.getAll();
      if (agents.length > 0) return agents;
    }
    return ChatService.FALLBACK_AGENTS;
  }

  /** Set routing rules from squad.config.ts for pattern-based routing. */
  setRoutingRules(rules: RoutingRule[]): void {
    this.routingRules = rules;
  }

  // ── Send message ────────────────────────────────────────────

  /**
   * Send a message: persist to both stores, emit via WebSocket,
   * and if it's a team message, generate a coordinator echo response.
   *
   * Throws ChannelMembershipError if the sender is not a member of the
   * target channel (security-critical — no message should leak to non-members).
   */
  async send(input: SendMessageInput): Promise<ChatMessage> {
    // Validate channel membership before persisting or broadcasting
    this.validateChannelMembership(input.sender, input.recipient);

    // Capture workspace at send time — async responses must use this, not current
    const messageWorkspaceId = this.workspaceId;

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
    this.emitChatMessage(message, messageWorkspaceId);

    // Route to agents — team messages go through routing, direct messages go to the specific agent
    if (input.recipient === CHAT_TEAM_RECIPIENT) {
      try {
        const echo = await this.coordinatorEcho(message, messageWorkspaceId);
        return echo;
      } catch (err) {
        console.error('[Chat] coordinatorEcho failed:', err);
      }
    } else {
      // Direct message to a specific agent
      const agent = this.getAgents().find((a) => a.id === input.recipient);
      if (agent && this.aiProvider) {
        this.handleDirectMessage(agent, message, messageWorkspaceId).catch((err) => {
          console.error(`[Chat] Direct message to ${agent.name} failed:`, err);
        });
      }
    }

    return message;
  }

  // ── Send with streaming ────────────────────────────────────

  /**
   * Send a message and stream agent responses token-by-token via a callback.
   * The caller (SSE route) writes each StreamEvent to the HTTP response.
   */
  async sendStream(
    input: SendMessageInput,
    onStreamEvent: (data: StreamEvent) => void,
  ): Promise<ChatMessage> {
    // Validate channel membership before persisting or broadcasting
    this.validateChannelMembership(input.sender, input.recipient);

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

    // Broadcast user message via WebSocket
    this.emitChatMessage(message);

    // Route to agents with streaming
    if (input.recipient === CHAT_TEAM_RECIPIENT) {
      await this.coordinatorEchoStream(message, onStreamEvent);
    } else {
      const agent = this.getAgents().find((a) => a.id === input.recipient);
      if (agent && this.aiProvider) {
        await this.handleDirectMessageStream(agent, message, onStreamEvent);
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

    const conditions: string[] = ['workspace_id = @workspaceId'];
    const params: Record<string, string> = { workspaceId: this.workspaceId };

    if (opts.agent) {
      conditions.push('(sender = @agent OR recipient = @agent)');
      params.agent = opts.agent;
    }

    if (opts.threadId) {
      conditions.push('thread_id = @threadId');
      params.threadId = opts.threadId;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

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

  /** Delete all messages, optionally filtered by agent/channel (thread). */
  async clearMessages(
    opts: {
      agent?: string;
      channel?: string;
    } = {},
  ): Promise<{ deleted: number }> {
    if (!this.db) return { deleted: 0 };

    const { agent, channel } = opts;
    const conditions: string[] = ['workspace_id = @workspaceId'];
    const params: Record<string, string> = { workspaceId: this.workspaceId };

    if (agent) {
      conditions.push('(sender = @agent OR recipient = @agent)');
      params.agent = agent;
    }
    if (channel) {
      conditions.push('thread_id = @channel');
      params.channel = channel;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const result = this.db.prepare(`DELETE FROM chat_messages ${whereClause}`).run(params);

    await this.clearSessionMarkdown(agent);

    return { deleted: result.changes };
  }

  /**
   * Remove chat entries from .squad/sessions/ markdown files.
   * If agent is provided, strips matching lines; otherwise deletes all chat-*.md files.
   */
  private async clearSessionMarkdown(agent?: string): Promise<void> {
    if (!this.sessionsDir) return;

    let files: string[];
    try {
      files = readdirSync(this.sessionsDir).filter(
        (f) => f.startsWith('chat-') && f.endsWith('.md'),
      );
    } catch {
      return;
    }

    for (const file of files) {
      const filePath = join(this.sessionsDir, file);
      try {
        if (!agent) {
          await unlink(filePath);
        } else {
          const content = await readFile(filePath, 'utf-8');
          const lines = content.split('\n');
          const filtered = lines.filter((line) => {
            // Keep header lines and lines that don't mention the agent
            if (line.startsWith('# ')) return true;
            const agentPattern = new RegExp(`\\b${agent}\\b`);
            // Only drop message lines matching "SENDER → RECIPIENT" with the agent
            if (line.includes('→') && agentPattern.test(line)) return false;
            return true;
          });
          const result = filtered.join('\n').trim();
          if (result === lines[0]?.trim()) {
            // Only header remains — remove file
            await unlink(filePath);
          } else {
            await writeFile(filePath, result + '\n', 'utf-8');
          }
        }
      } catch {
        // Best-effort cleanup
      }
    }
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

  // ── Message Pruning ────────────────────────────────────────────

  /**
   * Prune old messages beyond the retention window.
   * Archives pruned messages to `.squad/archive/` as JSONL before deletion.
   *
   * @param maxAgeDays - Delete messages older than this many days (default: 30)
   * @param maxPerChannel - Keep at most this many messages per channel/recipient (default: 500)
   * @returns Count of pruned messages
   */
  async pruneOldMessages(maxAgeDays = 30, maxPerChannel = 500): Promise<{ pruned: number }> {
    if (!this.db) return { pruned: 0 };

    let totalPruned = 0;

    // 1. Archive & delete messages older than maxAgeDays
    const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();
    const oldMessages = this.db
      .prepare('SELECT * FROM chat_messages WHERE timestamp < ? ORDER BY timestamp ASC')
      .all(cutoffDate) as Array<{
      id: string;
      sender: string;
      recipient: string;
      content: string;
      timestamp: string;
      thread_id: string | null;
    }>;

    if (oldMessages.length > 0) {
      await this.archiveMessages(oldMessages);
      this.db.prepare('DELETE FROM chat_messages WHERE timestamp < ?').run(cutoffDate);
      totalPruned += oldMessages.length;
    }

    // 2. For each channel/recipient, delete excess messages beyond maxPerChannel
    const recipients = this.db
      .prepare('SELECT DISTINCT recipient FROM chat_messages')
      .all() as Array<{ recipient: string }>;

    for (const { recipient } of recipients) {
      const count = (
        this.db
          .prepare('SELECT COUNT(*) as cnt FROM chat_messages WHERE recipient = ?')
          .get(recipient) as { cnt: number }
      ).cnt;

      if (count > maxPerChannel) {
        const excess = count - maxPerChannel;
        const excessMessages = this.db
          .prepare('SELECT * FROM chat_messages WHERE recipient = ? ORDER BY timestamp ASC LIMIT ?')
          .all(recipient, excess) as Array<{
          id: string;
          sender: string;
          recipient: string;
          content: string;
          timestamp: string;
          thread_id: string | null;
        }>;

        if (excessMessages.length > 0) {
          await this.archiveMessages(excessMessages);
          const ids = excessMessages.map((m) => m.id);
          const placeholders = ids.map(() => '?').join(',');
          this.db.prepare(`DELETE FROM chat_messages WHERE id IN (${placeholders})`).run(...ids);
          totalPruned += excessMessages.length;
        }
      }
    }

    if (totalPruned > 0) {
      console.log(
        `[Chat] Pruned ${totalPruned} messages (maxAge: ${maxAgeDays}d, maxPerChannel: ${maxPerChannel})`,
      );
    }

    return { pruned: totalPruned };
  }

  /** Archive messages to .squad/archive/chat-{date}.jsonl */
  private async archiveMessages(
    messages: Array<{
      id: string;
      sender: string;
      recipient: string;
      content: string;
      timestamp: string;
      thread_id: string | null;
    }>,
  ): Promise<void> {
    if (!this.sessionsDir) return;

    try {
      const archiveDir = join(this.sessionsDir, '..', 'archive');
      if (!existsSync(archiveDir)) {
        mkdirSync(archiveDir, { recursive: true });
      }

      const dateStr = new Date().toISOString().split('T')[0];
      const archivePath = join(archiveDir, `chat-${dateStr}.jsonl`);
      const lines = messages.map((m) => JSON.stringify(m)).join('\n') + '\n';
      await appendFile(archivePath, lines, 'utf-8');
    } catch (err) {
      console.warn('[Chat] Failed to archive messages:', err);
    }
  }

  // ── Channel CRUD ───────────────────────────────────────────────

  /** List all custom channels. */
  listChannels(): ChatChannel[] {
    if (!this.db) return [];

    const rows = this.db
      .prepare('SELECT * FROM chat_channels ORDER BY created_at ASC')
      .all() as Array<{
      id: string;
      name: string;
      description: string;
      member_agent_ids: string;
      created_at: string;
      updated_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      memberAgentIds: JSON.parse(row.member_agent_ids) as string[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  /** Get a single channel by ID. */
  getChannel(id: string): ChatChannel | null {
    if (!this.db) return null;

    const row = this.db.prepare('SELECT * FROM chat_channels WHERE id = ?').get(id) as
      | {
          id: string;
          name: string;
          description: string;
          member_agent_ids: string;
          created_at: string;
          updated_at: string;
        }
      | undefined;

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      memberAgentIds: JSON.parse(row.member_agent_ids) as string[],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /** Create a new channel. Validates name uniqueness, non-empty name, and non-empty member list. */
  createChannel(input: {
    name: string;
    description?: string;
    memberAgentIds?: string[];
  }): ChatChannel {
    // Validate name is provided and non-empty
    if (!input.name || input.name.trim() === '') {
      throw new ChannelValidationError('NAME_REQUIRED', 'Channel name is required');
    }

    // Validate memberAgentIds is not an explicit empty array
    if (input.memberAgentIds !== undefined && input.memberAgentIds.length === 0) {
      throw new ChannelValidationError(
        'EMPTY_MEMBER_LIST',
        'memberAgentIds must not be an empty array when provided',
      );
    }

    // Validate unique name within the DB
    if (this.db) {
      const existing = this.db
        .prepare('SELECT id FROM chat_channels WHERE name = ?')
        .get(input.name.trim()) as { id: string } | undefined;
      if (existing) {
        throw new ChannelValidationError(
          'DUPLICATE_NAME',
          `A channel named "${input.name.trim()}" already exists`,
        );
      }
    }

    const now = new Date().toISOString();
    const channel: ChatChannel = {
      id: nanoid(12),
      name: input.name.trim(),
      description: input.description ?? '',
      memberAgentIds: input.memberAgentIds ?? [],
      createdAt: now,
      updatedAt: now,
    };

    if (this.db) {
      this.db
        .prepare(
          `INSERT INTO chat_channels (id, name, description, member_agent_ids, created_at, updated_at)
           VALUES (@id, @name, @description, @memberAgentIds, @createdAt, @updatedAt)`,
        )
        .run({
          id: channel.id,
          name: channel.name,
          description: channel.description,
          memberAgentIds: JSON.stringify(channel.memberAgentIds),
          createdAt: channel.createdAt,
          updatedAt: channel.updatedAt,
        });
    }

    // Persist to .squad/channels/ markdown file
    if (this.channelsDir) {
      writeChannelFile(this.channelsDir, {
        name: channel.name,
        description: channel.description,
        memberAgentIds: channel.memberAgentIds,
      }).catch((err) => {
        console.error('[Chat] Failed to write channel file:', err);
      });
    }

    this.wsManager?.broadcast({
      type: 'channel:created',
      payload: channel as unknown as Record<string, unknown>,
      timestamp: now,
    });

    return channel;
  }

  /** Update an existing channel. Validates name uniqueness and non-empty member list. */
  updateChannel(
    id: string,
    input: { name?: string; description?: string; memberAgentIds?: string[] },
  ): ChatChannel | null {
    const existing = this.getChannel(id);
    if (!existing) return null;

    // Validate memberAgentIds is not an explicit empty array
    if (input.memberAgentIds !== undefined && input.memberAgentIds.length === 0) {
      throw new ChannelValidationError(
        'EMPTY_MEMBER_LIST',
        'memberAgentIds must not be an empty array when provided',
      );
    }

    // Validate name uniqueness when renaming (exclude current channel)
    if (input.name !== undefined && input.name.trim() !== existing.name && this.db) {
      const conflict = this.db
        .prepare('SELECT id FROM chat_channels WHERE name = ? AND id != ?')
        .get(input.name.trim(), id) as { id: string } | undefined;
      if (conflict) {
        throw new ChannelValidationError(
          'DUPLICATE_NAME',
          `A channel named "${input.name.trim()}" already exists`,
        );
      }
    }

    const now = new Date().toISOString();
    const updated: ChatChannel = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      memberAgentIds: input.memberAgentIds ?? existing.memberAgentIds,
      updatedAt: now,
    };

    if (this.db) {
      this.db
        .prepare(
          `UPDATE chat_channels
           SET name = @name, description = @description, member_agent_ids = @memberAgentIds, updated_at = @updatedAt
           WHERE id = @id`,
        )
        .run({
          id: updated.id,
          name: updated.name,
          description: updated.description,
          memberAgentIds: JSON.stringify(updated.memberAgentIds),
          updatedAt: updated.updatedAt,
        });
    }

    // Persist to .squad/channels/ markdown file
    if (this.channelsDir) {
      updateChannelFile(this.channelsDir, id, {
        name: updated.name,
        description: updated.description,
        memberAgentIds: updated.memberAgentIds,
      }).catch((err) => {
        console.error('[Chat] Failed to update channel file:', err);
      });
    }

    this.wsManager?.broadcast({
      type: 'channel:updated',
      payload: updated as unknown as Record<string, unknown>,
      timestamp: now,
    });

    return updated;
  }

  /** Delete a channel and clean up associated messages. */
  deleteChannel(id: string): DeleteChannelResult {
    if (!this.db) return { deleted: false, deletedMessages: 0 };

    const existing = this.getChannel(id);
    if (!existing) return { deleted: false, deletedMessages: 0 };

    // Clean up messages sent to this channel
    const channelRecipient = `${CHAT_CHANNEL_PREFIX}${id}`;
    const msgResult = this.db
      .prepare('DELETE FROM chat_messages WHERE recipient = ?')
      .run(channelRecipient);
    const deletedMessages = msgResult.changes;

    this.db.prepare('DELETE FROM chat_channels WHERE id = ?').run(id);

    // Remove .squad/channels/ markdown file
    if (this.channelsDir) {
      deleteChannelFile(this.channelsDir, id).catch((err) => {
        console.error('[Chat] Failed to delete channel file:', err);
      });
    }

    const now = new Date().toISOString();
    this.wsManager?.broadcast({
      type: 'channel:deleted',
      payload: { id, deletedMessages },
      timestamp: now,
    } as WsEnvelope);

    return { deleted: true, deletedMessages };
  }

  // ── Private: Channel membership validation ─────────────────────

  /**
   * Validate that the sender is allowed to post to the target recipient.
   * Only enforced for channel recipients (prefixed with CHAT_CHANNEL_PREFIX).
   * The 'user' sender (the human operator) is always permitted.
   *
   * Throws ChannelMembershipError if the channel doesn't exist or the
   * sender agent isn't in the channel's memberAgentIds.
   */
  private validateChannelMembership(sender: string, recipient: string): void {
    // Only validate channel-targeted messages
    if (!recipient.startsWith(CHAT_CHANNEL_PREFIX)) return;

    // Human user can always send to any channel
    if (sender === 'user') return;

    const channelId = recipient.slice(CHAT_CHANNEL_PREFIX.length);
    const channel = this.getChannel(channelId);

    if (!channel) {
      throw new ChannelMembershipError(
        'CHANNEL_NOT_FOUND',
        `Channel "${channelId}" does not exist`,
      );
    }

    if (!channel.memberAgentIds.includes(sender)) {
      throw new ChannelMembershipError(
        'NOT_A_MEMBER',
        `Agent "${sender}" is not a member of channel "${channel.name}"`,
      );
    }
  }

  // ── Private: Persistence ──────────────────────────────────────

  private persistToSqlite(msg: ChatMessage): void {
    if (!this.db) return;

    this.db
      .prepare(
        `INSERT INTO chat_messages (id, sender, recipient, content, timestamp, thread_id, workspace_id)
         VALUES (@id, @sender, @recipient, @content, @timestamp, @threadId, @workspaceId)`,
      )
      .run({
        id: msg.id,
        sender: msg.sender,
        recipient: msg.recipient,
        content: msg.content,
        timestamp: msg.timestamp,
        threadId: msg.threadId,
        workspaceId: this.workspaceId,
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

  private emitChatMessage(msg: ChatMessage, wsId?: string): void {
    if (!this.wsManager) return;

    const envelope: WsEnvelope = {
      type: 'chat:message',
      payload: { ...msg, workspaceId: wsId ?? this.workspaceId } as unknown as Record<string, unknown>,
      timestamp: msg.timestamp,
    };

    if (msg.recipient.startsWith(CHAT_CHANNEL_PREFIX)) {
      const channelId = msg.recipient.slice(CHAT_CHANNEL_PREFIX.length);
      this.wsManager.broadcastToChannel(channelId, envelope);
    } else {
      this.wsManager.broadcast(envelope);
    }
  }

  private emitTyping(agentId: string, agentName: string, recipient: string): void {
    if (!this.wsManager) return;

    this.wsManager.broadcast({
      type: 'chat:typing',
      payload: { agentId, agentName, isTyping: true, recipient, workspaceId: this.workspaceId },
      timestamp: new Date().toISOString(),
    });
  }

  private emitTypingStop(agentId: string, recipient: string): void {
    if (!this.wsManager) return;

    this.wsManager.broadcast({
      type: 'chat:typing',
      payload: { agentId, isTyping: false, recipient, workspaceId: this.workspaceId },
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

  /** Fetch recent chat history for context (last 10 messages in the channel). */
  private getRecentHistory(
    recipient: string,
  ): Array<{ role: 'user' | 'assistant'; content: string }> {
    if (!this.db) return [];

    try {
      const rows = this.db
        .prepare(
          `SELECT sender, content FROM chat_messages
           WHERE (recipient = @recipient OR sender = @recipient)
             AND workspace_id = @workspaceId
           ORDER BY timestamp DESC LIMIT 10`,
        )
        .all({ recipient, workspaceId: this.workspaceId }) as Array<{ sender: string; content: string }>;

      // Reverse so oldest first (chronological order)
      return rows.reverse().map((r) => ({
        role: (r.sender === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: r.content,
      }));
    } catch {
      return [];
    }
  }

  // ── Private: Agent responses ──────────────────────────────────

  /** Fallback agent definitions used when no AgentRegistry is connected. */
  private static readonly FALLBACK_AGENTS = [
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
  private async coordinatorEcho(original: ChatMessage, wsId?: string): Promise<ChatMessage> {
    if (this.aiProvider) {
      try {
        // First, determine which agents should respond
        const agentIds = await this.routeToAgents(original.content);
        const respondingAgents = this.getAgents().filter((a) => agentIds.includes(a.id));

        // Generate responses individually — don't let one failure kill all
        const responses: ChatMessage[] = [];
        for (const agent of respondingAgents) {
          try {
            this.emitTyping(agent.id, agent.name, CHAT_TEAM_RECIPIENT);
            const response = await this.generateAgentResponse(agent, original);
            this.emitTypingStop(agent.id, CHAT_TEAM_RECIPIENT);
            this.persistToSqlite(response);
            await this.persistToMarkdown(response);
            this.emitChatMessage(response, wsId);
            this.emitChatActivity(agent.id, `${agent.name} responded in chat`);
            responses.push(response);
          } catch (err) {
            this.emitTypingStop(agent.id, CHAT_TEAM_RECIPIENT);
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

    // Fallback: coordinator echo (no AI provider)
    const echo: ChatMessage = {
      id: nanoid(12),
      sender: 'coordinator',
      recipient: CHAT_TEAM_RECIPIENT,
      content: `📋 Received: "${original.content}" — routing to the squad. (AI provider not connected)`,
      timestamp: new Date().toISOString(),
      threadId: original.threadId,
    };

    this.persistToSqlite(echo);
    await this.persistToMarkdown(echo);
    this.emitChatMessage(echo, wsId);

    return echo;
  }

  /** Determine which agents should respond. Config routing rules → name match → LLM routing. */
  private async routeToAgents(content: string): Promise<string[]> {
    const lower = content.toLowerCase();
    const agents = this.getAgents();
    const leadId = agents.length > 0 ? agents[0]!.id : 'leela';

    // "team", "everyone", "each one", "all of you", "squad" → all agents
    if (/\b(team|everyone|each one|all of you|all agents|squad|everybody)\b/.test(lower)) {
      return agents.map((a) => a.id);
    }

    // Direct name match — if the user mentions an agent by name, route to them
    const mentioned = agents.filter(
      (a) => lower.includes(a.name.toLowerCase()) || lower.includes(a.id),
    );
    if (mentioned.length > 0) {
      return mentioned.map((a) => a.id);
    }

    // Config-driven routing rules — pattern match against message content
    if (this.routingRules.length > 0) {
      for (const rule of this.routingRules) {
        const pattern = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern, 'i');
        if (pattern.test(content)) {
          const agentIds = rule.agents.map((a) => a.replace(/^@/, ''));
          const valid = agentIds.filter((id) => agents.some((a) => a.id === id));
          if (valid.length > 0) {
            console.log(`[Chat] Routing rule matched: "${rule.pattern}" → [${valid.join(', ')}]`);
            return valid;
          }
        }
      }
    }

    // Short messages or greetings → route to lead agent as the default responder
    const isGreeting =
      /^\s*(hi|hey|hello|yo|sup|howdy|hiya|greetings|good\s*(morning|afternoon|evening))\b/i.test(
        content,
      );
    if (isGreeting || content.trim().length < 20) {
      return [leadId];
    }

    // No name mentioned — try LLM routing, fallback to lead agent
    if (!this.aiProvider) return [leadId];

    try {
      const profiles = agents.map((a) => ({
        id: a.id,
        name: a.name,
        role: a.role,
        keywords: [a.role.toLowerCase(), a.id],
      }));

      const result = await this.aiProvider.route(content, profiles, []);
      // Always ensure at least lead agent responds
      if (result.agentIds.length > 0) {
        if (!result.agentIds.includes(leadId)) {
          result.agentIds.unshift(leadId);
        }
        return result.agentIds;
      }
      return [leadId];
    } catch {
      return [leadId];
    }
  }

  /** Generate a single agent's response with their personality. */
  private async generateAgentResponse(
    agent: { id: string; name: string; role: string; personality: string },
    original: ChatMessage,
  ): Promise<ChatMessage> {
    const history = this.getRecentHistory(original.recipient);
    const messages = [...history, { role: 'user' as const, content: original.content }];
    const skillsFragment = this.getSkillsPromptForAgent(agent.role);

    const result = await this.aiProvider!.chatCompletion({
      agentId: agent.id,
      taskTitle: `Chat: ${original.content.substring(0, 50)}`,
      systemPrompt:
        `Personality: ${agent.personality} ` +
        `Respond in character as ${agent.name}. Keep responses concise (2-4 sentences). ` +
        `IMPORTANT: Only speak for yourself. Never speak on behalf of other agents or summarize what they did. ` +
        `Other agents will respond separately in their own messages. ` +
        `Never prefix your response with your name or any other agent's name — the UI handles that.` +
        (skillsFragment ? `\n\n${skillsFragment}` : ''),
      messages,
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
    wsId?: string,
  ): Promise<void> {
    try {
      this.emitTyping(agent.id, agent.name, agent.id);

      const history = this.getRecentHistory(agent.id);
      const messages = [...history, { role: 'user' as const, content: original.content }];
      const skillsFragment = this.getSkillsPromptForAgent(agent.role);

      const result = await this.aiProvider!.chatCompletion({
        agentId: agent.id,
        taskTitle: `DM: ${original.content.substring(0, 50)}`,
        systemPrompt:
          `You can and should take action on requests — create files, write code, run commands. ` +
          `If the user asks you to do something, do it. Don't just talk about it. ` +
          `Never prefix your response with your name — the UI handles that.` +
          (skillsFragment ? `\n\n${skillsFragment}` : ''),
        messages,
      });

      this.emitTypingStop(agent.id, agent.id);

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
      this.emitChatMessage(response, wsId);
      this.emitChatActivity(agent.id, `${agent.name} responded to direct message`);
    } catch (err) {
      this.emitTypingStop(agent.id, agent.id);
      console.error(`[Chat] ${agent.name} direct message failed:`, err);
    }
  }

  // ── Private: Streaming agent responses ────────────────────────

  /**
   * Route a team message to agents and stream each response token-by-token.
   */
  private async coordinatorEchoStream(
    original: ChatMessage,
    onStreamEvent: (data: StreamEvent) => void,
  ): Promise<void> {
    if (this.aiProvider) {
      try {
        const agentIds = await this.routeToAgents(original.content);
        const respondingAgents = this.getAgents().filter((a) => agentIds.includes(a.id));

        for (const agent of respondingAgents) {
          try {
            this.emitTyping(agent.id, agent.name, CHAT_TEAM_RECIPIENT);
            const response = await this.generateAgentResponseStream(
              agent,
              original,
              CHAT_TEAM_RECIPIENT,
              (chunk) => onStreamEvent({ agentId: agent.id, chunk, done: false }),
            );
            this.emitTypingStop(agent.id, CHAT_TEAM_RECIPIENT);
            this.persistToSqlite(response);
            await this.persistToMarkdown(response);
            this.emitChatMessage(response, wsId);
            this.emitChatActivity(agent.id, `${agent.name} responded in chat`);
            onStreamEvent({
              agentId: agent.id,
              chunk: '',
              done: true,
              fullContent: response.content,
            });
          } catch (err) {
            this.emitTypingStop(agent.id, CHAT_TEAM_RECIPIENT);
            console.error(`[Chat] ${agent.name} stream failed:`, err);
          }
        }

        if (respondingAgents.length > 0) return;
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
    this.emitChatMessage(echo, wsId);
    onStreamEvent({ agentId: 'leela', chunk: echo.content, done: false });
    onStreamEvent({ agentId: 'leela', chunk: '', done: true, fullContent: echo.content });
  }

  /** Handle a direct message to a specific agent with streaming. */
  private async handleDirectMessageStream(
    agent: { id: string; name: string; role: string; personality: string },
    original: ChatMessage,
    onStreamEvent: (data: StreamEvent) => void,
  ): Promise<void> {
    try {
      this.emitTyping(agent.id, agent.name, agent.id);
      const response = await this.generateAgentResponseStream(agent, original, agent.id, (chunk) =>
        onStreamEvent({ agentId: agent.id, chunk, done: false }),
      );
      this.emitTypingStop(agent.id, agent.id);
      this.persistToSqlite(response);
      await this.persistToMarkdown(response);
      this.emitChatMessage(response, wsId);
      this.emitChatActivity(agent.id, `${agent.name} responded to direct message`);
      onStreamEvent({
        agentId: agent.id,
        chunk: '',
        done: true,
        fullContent: response.content,
      });
    } catch (err) {
      this.emitTypingStop(agent.id, agent.id);
      console.error(`[Chat] ${agent.name} direct message stream failed:`, err);
    }
  }

  /** Generate a single agent's response with streaming via onChunk. */
  private async generateAgentResponseStream(
    agent: { id: string; name: string; role: string; personality: string },
    original: ChatMessage,
    responseRecipient: string,
    onChunk: (chunk: string) => void,
  ): Promise<ChatMessage> {
    const isDirectMessage = responseRecipient !== CHAT_TEAM_RECIPIENT;
    const skillsFragment = this.getSkillsPromptForAgent(agent.role);
    const skillsSuffix = skillsFragment ? `\n\n${skillsFragment}` : '';

    const systemPrompt = isDirectMessage
      ? `You are ${agent.name}, the ${agent.role} of the openspace.ai squad. ` +
        `Personality: ${agent.personality} ` +
        `The user is talking directly to you. Respond in character as ${agent.name}. ` +
        `You can and should take action on requests — create files, write code, run commands. ` +
        `If the user asks you to do something, do it. Don't just talk about it. ` +
        `Never prefix your response with your name — the UI handles that.` +
        skillsSuffix
      : `You are ${agent.name}, the ${agent.role} of the openspace.ai squad. ` +
        `Personality: ${agent.personality} ` +
        `Respond in character as ${agent.name}. Keep responses concise (2-4 sentences). ` +
        `IMPORTANT: Only speak for yourself. Never speak on behalf of other agents or summarize what they did. ` +
        `Other agents will respond separately in their own messages. ` +
        `Never prefix your response with your name or any other agent's name — the UI handles that.` +
        skillsSuffix;

    const history = this.getRecentHistory(responseRecipient);
    const messages = [...history, { role: 'user' as const, content: original.content }];

    const result = await this.aiProvider!.chatCompletion({
      agentId: agent.id,
      taskTitle: `Chat: ${original.content.substring(0, 50)}`,
      systemPrompt,
      messages,
      stream: true,
      onChunk,
    });

    return {
      id: nanoid(12),
      sender: agent.id,
      recipient: responseRecipient,
      content: result.content,
      timestamp: new Date().toISOString(),
      threadId: original.threadId,
    };
  }
}
