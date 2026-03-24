/**
 * Agent Worker Service — picks up backlog tasks and executes them via copilot-sdk.
 *
 * Each agent works on one task at a time (queue-based).
 * Queue is persisted to .squad/.cache/agent-queue.json for crash recovery.
 * On startup, recovers in-progress tasks back into the queue.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

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
  /** Path to persist queue state. Default: <tasksDir>/../.cache/agent-queue.json */
  queueFilePath?: string;
  aiProvider: AIProvider;
  activityFeed: ActivityFeed;
  wsManager: WebSocketManager | null;
  agents: AgentProfile[];
  pollIntervalMs?: number;
}

interface QueueState {
  queues: Record<string, string[]>;
  active: Record<string, string | null>;
}

// ── Agent Worker ─────────────────────────────────────────────────

export class AgentWorkerService {
  private readonly config: AgentWorkerConfig;
  private readonly queues = new Map<string, string[]>();
  private readonly activeTask = new Map<string, string>();
  private readonly queueFilePath: string;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(config: AgentWorkerConfig) {
    this.config = config;
    this.queueFilePath =
      config.queueFilePath ?? join(config.tasksDir, '..', '.cache', 'agent-queue.json');

    for (const agent of config.agents) {
      this.queues.set(agent.id, []);
    }
  }

  /** Add a task to the assigned agent's queue. */
  enqueue(task: Task): void {
    if (!task.assignee) return;
    const queue = this.queues.get(task.assignee);
    if (!queue) return;

    if (queue.includes(task.id) || this.activeTask.get(task.assignee) === task.id) return;

    queue.push(task.id);
    this.persistQueue();
    console.log(`[AgentWorker] Queued ${task.id} for ${task.assignee} (queue: ${queue.length})`);

    this.emitActivity(task.assignee, 'spawned', `Task queued: ${task.title}`);
    this.processNext(task.assignee);
  }

  /** Start the worker — recovers state from disk, then polls. */
  async start(): Promise<void> {
    await this.recover();

    if (this.pollTimer) return;
    this.pollTimer = setInterval(() => {
      for (const agent of this.config.agents) {
        if (!this.activeTask.has(agent.id)) {
          this.processNext(agent.id);
        }
      }
    }, this.config.pollIntervalMs ?? 5000);
  }

  stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.persistQueue();
  }

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

  // ── Recovery ───────────────────────────────────────────────────

  /** Recover queue state from disk + re-enqueue in-progress tasks. */
  private async recover(): Promise<void> {
    // 1. Load persisted queue state
    this.loadQueue();

    // 2. Scan for orphaned in-progress tasks (server crashed mid-work)
    try {
      const { readdir } = await import('node:fs/promises');
      const files = await readdir(this.config.tasksDir);
      for (const file of files) {
        if (!file.endsWith('.md')) continue;
        try {
          const taskId = file.replace('.md', '');
          const task = await getTask(this.config.tasksDir, taskId);
          if (task.status === 'in-progress' && task.assignee) {
            const queue = this.queues.get(task.assignee);
            const isAlreadyQueued = queue?.includes(task.id);
            const isActive = this.activeTask.get(task.assignee) === task.id;

            // Check retry count from description
            const retryCount = (task.description.match(/🚀.*started working/g) ?? []).length;
            if (retryCount >= 3) {
              // Too many retries — mark as blocked permanently
              await updateTask(this.config.tasksDir, taskId, {
                status: 'blocked',
                description:
                  task.description +
                  `\n\n---\n**[${new Date().toISOString().replace('T', ' ').substring(0, 19)}]** 🛑 Permanently blocked after ${retryCount} failed attempts.`,
              });
              console.log(
                `[AgentWorker] Task ${taskId} permanently blocked after ${retryCount} retries`,
              );
              continue;
            }

            if (!isAlreadyQueued && !isActive) {
              await updateTask(this.config.tasksDir, taskId, { status: 'backlog' });
              queue?.push(task.id);
              console.log(
                `[AgentWorker] Recovered orphaned task ${taskId} for ${task.assignee} (attempt ${retryCount + 1})`,
              );
              this.emitActivity(task.assignee, 'spawned', `Recovered after restart: ${task.title}`);
            }
          }
        } catch {
          // Skip unparseable files
        }
      }
    } catch {
      // Tasks dir might not exist yet
    }

    this.persistQueue();

    // 3. Kick off processing for any recovered queues
    for (const agent of this.config.agents) {
      if (!this.activeTask.has(agent.id) && (this.queues.get(agent.id)?.length ?? 0) > 0) {
        this.processNext(agent.id);
      }
    }
  }

  // ── Persistence ────────────────────────────────────────────────

  private persistQueue(): void {
    try {
      const dir = dirname(this.queueFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const state: QueueState = {
        queues: Object.fromEntries(this.queues),
        active: Object.fromEntries(
          this.config.agents.map((a) => [a.id, this.activeTask.get(a.id) ?? null]),
        ),
      };
      writeFileSync(this.queueFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[AgentWorker] Failed to persist queue:', err);
    }
  }

  private loadQueue(): void {
    try {
      if (!existsSync(this.queueFilePath)) return;
      const raw = readFileSync(this.queueFilePath, 'utf-8');
      const state = JSON.parse(raw) as QueueState;

      for (const [agentId, taskIds] of Object.entries(state.queues)) {
        if (this.queues.has(agentId)) {
          this.queues.set(agentId, taskIds);
        }
      }
      // Don't restore activeTask — those need re-processing
      // Instead, add them back to front of queue
      for (const [agentId, taskId] of Object.entries(state.active)) {
        if (taskId && this.queues.has(agentId)) {
          const queue = this.queues.get(agentId)!;
          if (!queue.includes(taskId)) {
            queue.unshift(taskId);
          }
        }
      }

      console.log('[AgentWorker] Loaded queue state from disk');
    } catch {
      // No state file or corrupt — start fresh
    }
  }

  // ── Task Processing ────────────────────────────────────────────

  private async processNext(agentId: string): Promise<void> {
    if (this.activeTask.has(agentId)) return;

    const queue = this.queues.get(agentId);
    if (!queue || queue.length === 0) return;

    const taskId = queue.shift()!;
    this.activeTask.set(agentId, taskId);
    this.persistQueue();

    try {
      const task = await getTask(this.config.tasksDir, taskId);
      const agent = this.config.agents.find((a) => a.id === agentId);
      if (!agent) {
        this.activeTask.delete(agentId);
        this.persistQueue();
        return;
      }

      const now = () => new Date().toISOString().replace('T', ' ').substring(0, 19);

      await updateTask(this.config.tasksDir, taskId, {
        status: 'in-progress',
        description:
          task.description +
          `\n\n---\n**[${now()}]** 🚀 ${agent.name} started working on this task.`,
      });
      this.broadcastTaskUpdate(taskId, 'in-progress');
      this.emitActivity(agentId, 'started', `Started working on: ${task.title}`);
      this.persistQueue();

      console.log(`[AgentWorker] ${agent.name} started: ${task.title}`);

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

      await updateTask(this.config.tasksDir, taskId, {
        status: 'done',
        description:
          task.description +
          `\n\n---\n**[${now()}]** 🚀 ${agent.name} started working on this task.` +
          `\n\n**[${now()}]** ✅ ${agent.name} completed this task.\n\n**Result:**\n${result.content}`,
      });
      this.broadcastTaskUpdate(taskId, 'done');
      this.emitActivity(
        agentId,
        'completed',
        `Completed: ${task.title} — ${result.content.substring(0, 100)}`,
      );

      console.log(`[AgentWorker] ${agent.name} completed: ${task.title}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack?.substring(0, 300) : '';
      console.error(`[AgentWorker] ${agentId} failed on ${taskId}:`, message);

      try {
        const currentTask = await getTask(this.config.tasksDir, taskId).catch(() => null);
        const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
        await updateTask(this.config.tasksDir, taskId, {
          status: 'blocked',
          description:
            (currentTask?.description ?? '') +
            `\n\n---\n**[${now}]** ❌ **BLOCKED** — ${agentId} failed.\n\n**Error:** ${message}\n\n**Stack:** \`\`\`\n${stack}\n\`\`\``,
        });
        this.broadcastTaskUpdate(taskId, 'blocked');
      } catch {
        /* best effort */
      }
      this.emitActivity(agentId, 'failed', `Failed: ${taskId} — ${message.substring(0, 80)}`);
    } finally {
      this.activeTask.delete(agentId);
      this.persistQueue();
      // Wait before picking next task to let resources settle
      setTimeout(() => this.processNext(agentId), 3000);
    }
  }

  // ── Broadcasting ───────────────────────────────────────────────

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
