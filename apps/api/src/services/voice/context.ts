/**
 * Conversation Context Manager (P4-5)  Shared voice session state.
 *
 * Maintains shared conversation state across all agents in a voice session.
 * Last N messages as context window. Agents "hear" what other agents said.
 * Persists voice session transcripts to .squad/sessions/.
 */

import { existsSync, mkdirSync } from 'node:fs';
import { appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { VoiceMessage, VoiceParticipantRole } from '@openspace/shared';
import { nanoid } from 'nanoid';

//  Types ─

export interface ConversationContextConfig {
  /** Max messages in the context window (default: 50). */
  maxContextWindow?: number;
  /** Directory for persisting transcripts (default: null = no persistence). */
  sessionsDir?: string | null;
}

export interface ConversationEntry {
  /** The voice message. */
  message: VoiceMessage;
  /** Summary for context (shorter than full content). */
  summary?: string;
}

export interface SessionContext {
  /** Session ID. */
  sessionId: string;
  /** All messages in the session (bounded by maxContextWindow). */
  messages: VoiceMessage[];
  /** Current topic being discussed (extracted from conversation). */
  currentTopic: string | null;
  /** Actions executed during this session. */
  actionLog: ActionLogEntry[];
  /** When context was last updated. */
  lastUpdatedAt: string;
}

export interface ActionLogEntry {
  /** What action was taken. */
  action: string;
  /** Agent that executed it. */
  agentId: string;
  /** Result summary. */
  result: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

//  Context Manager ─

export class ConversationContextManager {
  private contexts = new Map<string, SessionContext>();
  private readonly maxContextWindow: number;
  private readonly sessionsDir: string | null;

  constructor(config: ConversationContextConfig = {}) {
    this.maxContextWindow = config.maxContextWindow ?? 50;
    this.sessionsDir = config.sessionsDir ?? null;

    if (this.sessionsDir && !existsSync(this.sessionsDir)) {
      mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  //  Session context lifecycle

  /** Initialize context for a new session. */
  createContext(sessionId: string): SessionContext {
    const ctx: SessionContext = {
      sessionId,
      messages: [],
      currentTopic: null,
      actionLog: [],
      lastUpdatedAt: new Date().toISOString(),
    };
    this.contexts.set(sessionId, ctx);
    return ctx;
  }

  /** Get the full context for a session. */
  getContext(sessionId: string): SessionContext | null {
    return this.contexts.get(sessionId) ?? null;
  }

  /** Remove context for a session (cleanup). */
  removeContext(sessionId: string): boolean {
    return this.contexts.delete(sessionId);
  }

  //  Adding messages ─

  /**
   * Add a message to the session context.
   * Trims to maxContextWindow and persists to disk.
   */
  async addMessage(
    sessionId: string,
    role: VoiceParticipantRole,
    agentId: string | null,
    content: string,
  ): Promise<VoiceMessage> {
    let ctx = this.contexts.get(sessionId);
    if (!ctx) {
      ctx = this.createContext(sessionId);
    }

    const message: VoiceMessage = {
      id: nanoid(12),
      sessionId,
      role,
      agentId,
      content,
      timestamp: new Date().toISOString(),
      durationMs: null,
    };

    ctx.messages.push(message);

    // Trim to context window
    if (ctx.messages.length > this.maxContextWindow) {
      ctx.messages = ctx.messages.slice(-this.maxContextWindow);
    }

    ctx.lastUpdatedAt = message.timestamp;

    // Update topic from recent messages
    this.updateTopic(ctx);

    // Persist to disk
    await this.persistMessage(sessionId, message);

    return message;
  }

  //  Context for agents ─

  /**
   * Get the recent context window for an agent to use when responding.
   * Returns the last N messages as formatted context.
   */
  getContextWindow(sessionId: string, limit?: number): VoiceMessage[] {
    const ctx = this.contexts.get(sessionId);
    if (!ctx) return [];

    const windowSize = limit ?? this.maxContextWindow;
    return ctx.messages.slice(-windowSize);
  }

  /**
   * Get a text summary of recent conversation for LLM prompting.
   */
  getContextSummary(sessionId: string, limit = 10): string {
    const messages = this.getContextWindow(sessionId, limit);
    if (messages.length === 0) return '';

    return messages
      .map((m) => {
        const speaker = m.role === 'user' ? 'User' : (m.agentId ?? 'Agent');
        return `${speaker}: ${m.content}`;
      })
      .join('\n');
  }

  //  Action log ─

  /** Log an action executed during a voice session. */
  logAction(
    sessionId: string,
    agentId: string,
    action: string,
    result: string,
  ): ActionLogEntry | null {
    const ctx = this.contexts.get(sessionId);
    if (!ctx) return null;

    const entry: ActionLogEntry = {
      action,
      agentId,
      result,
      timestamp: new Date().toISOString(),
    };

    ctx.actionLog.push(entry);
    ctx.lastUpdatedAt = entry.timestamp;

    return entry;
  }

  /** Get action log for a session. */
  getActionLog(sessionId: string): ActionLogEntry[] {
    return this.contexts.get(sessionId)?.actionLog ?? [];
  }

  //  Topic tracking

  /** Set the current topic manually. */
  setTopic(sessionId: string, topic: string): void {
    const ctx = this.contexts.get(sessionId);
    if (ctx) {
      ctx.currentTopic = topic;
      ctx.lastUpdatedAt = new Date().toISOString();
    }
  }

  /** Get the current topic. */
  getTopic(sessionId: string): string | null {
    return this.contexts.get(sessionId)?.currentTopic ?? null;
  }

  //  Persistence

  /**
   * Persist the full session transcript to .squad/sessions/.
   * Called on session end.
   */
  async persistSession(sessionId: string, title: string): Promise<string | null> {
    if (!this.sessionsDir) return null;

    const ctx = this.contexts.get(sessionId);
    if (!ctx || ctx.messages.length === 0) return null;

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `voice-${dateStr}-${sessionId}.md`;
    const filePath = join(this.sessionsDir, filename);

    const lines: string[] = [
      `# Voice Session: ${title}`,
      '',
      `**Session ID:** ${sessionId}`,
      `**Date:** ${dateStr}`,
      `**Messages:** ${ctx.messages.length}`,
      '',
      '## Transcript',
      '',
    ];

    for (const msg of ctx.messages) {
      const speaker = msg.role === 'user' ? 'User' : (msg.agentId ?? 'Agent');
      lines.push(`**[${speaker}] ${msg.timestamp}:** ${msg.content}`);
      lines.push('');
    }

    if (ctx.actionLog.length > 0) {
      lines.push('## Actions Executed');
      lines.push('');
      for (const action of ctx.actionLog) {
        lines.push(
          `- **${action.action}** by ${action.agentId}: ${action.result} (${action.timestamp})`,
        );
      }
      lines.push('');
    }

    try {
      await writeFile(filePath, lines.join('\n'), 'utf-8');
      return filePath;
    } catch {
      return null;
    }
  }

  //  Private

  /** Simple topic extraction from the last few messages. */
  private updateTopic(ctx: SessionContext): void {
    const recent = ctx.messages.slice(-3);
    const userMessages = recent.filter((m) => m.role === 'user');
    if (userMessages.length > 0) {
      // Use the last user message as a rough topic indicator
      const lastUserMsg = userMessages[userMessages.length - 1]!.content;
      if (lastUserMsg.length > 5) {
        ctx.currentTopic = lastUserMsg.slice(0, 100);
      }
    }
  }

  /** Persist a single message to the session log file (incremental). */
  private async persistMessage(sessionId: string, msg: VoiceMessage): Promise<void> {
    if (!this.sessionsDir) return;

    const dateStr = msg.timestamp.slice(0, 10);
    const filename = `voice-${dateStr}-${sessionId}.md`;
    const filePath = join(this.sessionsDir, filename);

    const speaker = msg.role === 'user' ? 'User' : (msg.agentId ?? 'Agent');
    const line = `\n**[${speaker}] ${msg.timestamp}:** ${msg.content}\n`;

    try {
      if (existsSync(filePath)) {
        await appendFile(filePath, line, 'utf-8');
      } else {
        const header = '# Voice Session Transcript\n';
        await writeFile(filePath, header + line, 'utf-8');
      }
    } catch {
      // Best-effort persistence
    }
  }

  /** Shutdown: persist all active sessions and clear. */
  async shutdown(): Promise<void> {
    for (const [sessionId, ctx] of this.contexts) {
      if (ctx.messages.length > 0) {
        await this.persistSession(sessionId, 'Auto-saved on shutdown');
      }
    }
    this.contexts.clear();
  }
}
