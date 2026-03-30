/**
 * AgentExecutor that delegates to the existing AIProvider for chat completions.
 *
 * Bridge layer: after generating an A2A response the executor also
 *   1. saves the message to the ChatService (appears in chat feed)
 *   2. broadcasts via WebSocket (real-time UI update)
 *   3. emits an activity event (activity feed)
 *   4. optionally creates a task when the incoming message requests one
 */

import type { Message } from '@a2a-js/sdk';
import type { AgentExecutor, ExecutionEventBus, RequestContext } from '@a2a-js/sdk/server';
import { CHAT_TEAM_RECIPIENT } from '@openspace/shared';
import { nanoid } from 'nanoid';

import type { ActivityFeed } from '../activity/index.js';
import type { AIProvider } from '../ai/copilot-provider.js';
import type { ChatService } from '../chat/index.js';
import type { WebSocketManager } from '../websocket/index.js';

// ── Bridge services (all optional — A2A works standalone without them) ───

export interface A2ABridgeServices {
  chatService?: ChatService | null;
  wsManager?: WebSocketManager | null;
  activityFeed?: ActivityFeed | null;
  /** Absolute path to .squad/tasks/ — needed for task creation bridge. */
  tasksDir?: string | null;
}

export interface SquadExecutorOptions {
  agentId: string;
  agentName: string;
  agentRole: string;
  personality: string;
  aiProvider: AIProvider;
  /** Optional bridge services for cross-system integration. */
  bridge?: A2ABridgeServices;
}

/** Keywords that signal the sender wants a task created. */
const TASK_KEYWORDS =
  /\b(create a task|open a task|add a task|new task|file a task|make a task|assign a task)\b/i;

/**
 * Wraps the app's AIProvider so each squad agent can be invoked via A2A.
 */
export class SquadAgentExecutor implements AgentExecutor {
  private readonly agentId: string;
  private readonly agentName: string;
  private readonly agentRole: string;
  private readonly personality: string;
  private readonly aiProvider: AIProvider;
  private readonly bridge: A2ABridgeServices;

  constructor(opts: SquadExecutorOptions) {
    this.agentId = opts.agentId;
    this.agentName = opts.agentName;
    this.agentRole = opts.agentRole;
    this.personality = opts.personality;
    this.aiProvider = opts.aiProvider;
    this.bridge = opts.bridge ?? {};
  }

  async execute(requestContext: RequestContext, eventBus: ExecutionEventBus): Promise<void> {
    // Extract text from the incoming user message
    const userText = requestContext.userMessage.parts
      .filter((p): p is { kind: 'text'; text: string } => p.kind === 'text')
      .map((p) => p.text)
      .join('\n');

    const systemPrompt = [
      `You are ${this.agentName}, the ${this.agentRole} of the squad.`,
      `Personality: ${this.personality}`,
      'Respond concisely and stay in character.',
    ].join('\n');

    try {
      const result = await this.aiProvider.chatCompletion({
        systemPrompt,
        messages: [{ role: 'user', content: userText }],
      });

      const responseMessage: Message = {
        kind: 'message',
        messageId: nanoid(),
        role: 'agent',
        parts: [{ kind: 'text', text: result.content }],
        contextId: requestContext.contextId,
        taskId: requestContext.taskId,
      };

      // ── A2A response (existing) ──────────────────────────────
      eventBus.publish(responseMessage);

      // ── Bridge: save to chat feed ────────────────────────────
      this.bridgeToChatFeed(userText, result.content, requestContext);

      // ── Bridge: activity event ───────────────────────────────
      this.bridgeToActivity('completed', `A2A response from ${this.agentName}`);

      // ── Bridge: task creation (if requested) ─────────────────
      this.bridgeToTaskCreation(userText, result.content);
    } catch (err) {
      const errorText = err instanceof Error ? err.message : 'Unknown error';
      const errorMessage: Message = {
        kind: 'message',
        messageId: nanoid(),
        role: 'agent',
        parts: [{ kind: 'text', text: `Error: ${errorText}` }],
        contextId: requestContext.contextId,
        taskId: requestContext.taskId,
      };
      eventBus.publish(errorMessage);

      this.bridgeToActivity('failed', `A2A error from ${this.agentName}: ${errorText}`);
    } finally {
      eventBus.finished();
    }
  }

  async cancelTask(_taskId: string, eventBus: ExecutionEventBus): Promise<void> {
    eventBus.finished();
  }

  // ── Bridge helpers (all best-effort, never throw) ──────────────

  /** Save the A2A response as a chat message so it appears in the UI chat feed. */
  private bridgeToChatFeed(userText: string, responseText: string, ctx: RequestContext): void {
    const { chatService } = this.bridge;
    if (!chatService) return;

    // Fire-and-forget — don't block the A2A response
    const threadId = ctx.contextId ?? null;

    // Save the incoming user message so chat has the full conversation
    chatService
      .send({
        sender: 'a2a-external',
        recipient: this.agentId,
        content: userText,
        threadId,
      })
      .catch((e) => console.warn('[A2A→Chat] Failed to save incoming message:', e));

    // Save the agent's response
    chatService
      .send({
        sender: this.agentId,
        recipient: CHAT_TEAM_RECIPIENT,
        content: responseText,
        threadId,
      })
      .catch((e) => console.warn('[A2A→Chat] Failed to save agent response:', e));
  }

  /** Emit an activity event for the A2A interaction. */
  private bridgeToActivity(type: 'started' | 'completed' | 'failed', description: string): void {
    const { activityFeed } = this.bridge;
    if (!activityFeed) return;

    try {
      activityFeed.push({
        id: `act-a2a-${Date.now()}-${this.agentId}`,
        type,
        agentId: this.agentId,
        description,
        timestamp: new Date().toISOString(),
        relatedEntityId: null,
      });
    } catch (e) {
      console.warn('[A2A→Activity] Failed to push activity:', e);
    }
  }

  /** If the user message explicitly requests a task, create one. */
  private bridgeToTaskCreation(userText: string, responseText: string): void {
    const { tasksDir } = this.bridge;
    if (!tasksDir || !TASK_KEYWORDS.test(userText)) return;

    // Dynamically import the task writer to avoid circular dependency issues
    import('../squad-writer/task-writer.js')
      .then(({ createTask }) =>
        createTask(tasksDir, {
          title: `A2A request: ${userText.substring(0, 80)}`,
          description:
            `Created from an A2A message to **${this.agentName}**.\n\n` +
            `**Original request:**\n${userText}\n\n` +
            `**Agent response:**\n${responseText}`,
          status: 'pending',
          priority: 'P2',
          assignee: this.agentId,
          labels: ['a2a'],
        }),
      )
      .then((task) => {
        console.log(`[A2A→Task] Created task ${task.id} for ${this.agentId}`);

        // Broadcast the new task via WebSocket
        this.bridge.wsManager?.broadcast({
          type: 'task:created',
          payload: task as unknown as Record<string, unknown>,
          timestamp: new Date().toISOString(),
        });

        // Activity event for the new task
        this.bridgeToActivity('started', `Task created from A2A: ${task.title}`);
      })
      .catch((e) => console.warn('[A2A→Task] Failed to create task:', e));
  }
}
