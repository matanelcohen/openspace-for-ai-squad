/**
 * Agent Worker Service — picks up backlog tasks and executes them via copilot-sdk.
 *
 * Each agent works on one task at a time (queue-based).
 * Updates task status: backlog → in-progress → done.
 * Emits activity events for progress tracking.
 */

import type { Task } from '@openspace/shared';

import type { ActivityFeed } from '../activity/index.js';
import type { AIProvider } from '../ai/copilot-provider.js';
import { getTask, updateTask } from '../squad-writer/task-writer.js';
import type { WebSocketManager } from '../websocket/index.js';

// ── Types ────────────────────────────────────────────────────────

interface AgentProfile {
  id: string;
  name: string;
  role: string;
  personality: string;
}

interface AgentWorkerConfig {
  tasksDir: string;
  aiProvider: AIProvider;
  activityFeed: ActivityFeed;
  wsManager: WebSocketManager | null;
  agents: AgentProfile[];
  /** How often to check for queued tasks (ms). Default: 5000 */
  pollIntervalMs?: number;
}

// ── Agent Worker ─────────────────────────────────────────────────

export class AgentWorkerService {
  private readonly config: AgentWorkerConfig;
  private readonly queues = new Map<string, string[]>(); // agentId → taskId[]
  private readonly activeTask = new Map<string, string>(); // agentId → taskId currently working on
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: AgentWorkerConfig) {
    this.config = config;
    for (const agent of config.agents) {
      this.queues.set(agent.id, []);
    }
  }

  /** Add a task to the assigned agent's queue. */
  enqueue(task: Task): void {
    if (!task.assignee) return;
    const queue = this.queues.get(task.assignee);
    if (!queue) return;

    // Don't add duplicates
    if (queue.includes(task.id) || this.activeTask.get(task.assignee) === task.id) return;

    queue.push(task.id);
    console.log(`[AgentWorker] Queued ${task.id} for ${task.assignee} (queue: ${queue.length})`);

    this.emitActivity(task.assignee, 'spawned', `Task queued: ${task.title}`);

    // Try to process immediately
    this.processNext(task.assignee);
  }

  /** Start periodic polling for idle agents. */
  start(): void {
    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      for (const agent of this.config.agents) {
        if (!this.activeTask.has(agent.id)) {
          this.processNext(agent.id);
        }
      }
    }, this.config.pollIntervalMs ?? 5000);
  }

  /** Stop the worker. */
  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /** Get queue status for all agents. */
  getStatus(): Record<string, { activeTask: string | null; queueLength: number }> {
    const status: Record<string, { activeTask: string | null; queueLength: number }> = {};
    for (const agent of this.config.agents) {
      status[agent.id] = {
        activeTask: this.activeTask.get(agent.id) ?? null,
        queueLength: this.queues.get(agent.id)?.length ?? 0,
      };
    }
    return status;
  }

  // ── Private: Task Processing ───────────────────────────────────

  private async processNext(agentId: string): Promise<void> {
    if (this.activeTask.has(agentId)) return;

    const queue = this.queues.get(agentId);
    if (!queue || queue.length === 0) return;

    const taskId = queue.shift()!;
    this.activeTask.set(agentId, taskId);

    try {
      // Load task
      const task = await getTask(this.config.tasksDir, taskId);
      const agent = this.config.agents.find((a) => a.id === agentId);
      if (!agent) {
        this.activeTask.delete(agentId);
        return;
      }

      // Move to in-progress
      await updateTask(this.config.tasksDir, taskId, { status: 'in-progress' });
      this.broadcastTaskUpdate(taskId, 'in-progress');
      this.emitActivity(agentId, 'started', `Started working on: ${task.title}`);

      console.log(`[AgentWorker] ${agent.name} started: ${task.title}`);

      // Execute the task via copilot-sdk
      const result = await this.config.aiProvider.chatCompletion({
        systemPrompt:
          `You are ${agent.name}, the ${agent.role} of the openspace.ai squad. ` +
          `Personality: ${agent.personality}\n\n` +
          `You have been assigned a task. Execute it fully — write code, create files, make changes. ` +
          `Do the actual work, don't just describe what you would do.\n\n` +
          `When done, provide a brief summary of what you did.`,
        messages: [
          {
            role: 'user',
            content: `Task: ${task.title}\n\nDescription: ${task.description || '(none)'}\n\nPriority: ${task.priority}\n\nPlease complete this task.`,
          },
        ],
      });

      // Move to done
      await updateTask(this.config.tasksDir, taskId, { status: 'done' });
      this.broadcastTaskUpdate(taskId, 'done');
      this.emitActivity(
        agentId,
        'completed',
        `Completed: ${task.title} — ${result.content.substring(0, 100)}`,
      );

      console.log(`[AgentWorker] ${agent.name} completed: ${task.title}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[AgentWorker] ${agentId} failed on ${taskId}:`, message);

      // Move to blocked on failure
      try {
        await updateTask(this.config.tasksDir, taskId, { status: 'blocked' });
        this.broadcastTaskUpdate(taskId, 'blocked');
      } catch {
        /* best effort */
      }
      this.emitActivity(agentId, 'failed', `Failed: ${taskId} — ${message.substring(0, 80)}`);
    } finally {
      this.activeTask.delete(agentId);
      // Check for next task
      this.processNext(agentId);
    }
  }

  // ── Private: Broadcasting ──────────────────────────────────────

  private broadcastTaskUpdate(taskId: string, status: string): void {
    this.config.wsManager?.broadcast({
      type: 'task:updated',
      payload: { id: taskId, taskId, status },
      timestamp: new Date().toISOString(),
    });
  }

  private emitActivity(
    agentId: string,
    type: 'spawned' | 'started' | 'completed' | 'failed',
    description: string,
  ): void {
    this.config.activityFeed.push({
      id: `act-${Date.now()}-${agentId}`,
      type,
      agentId,
      description,
      timestamp: new Date().toISOString(),
      relatedEntityId: null,
    });
  }
}
