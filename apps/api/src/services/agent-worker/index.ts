/**
 * Agent Worker Service — picks up backlog tasks and executes them via copilot-sdk.
 *
 * Each agent works on one task at a time (queue-based).
 * Queue is persisted to .squad/.cache/agent-queue.json for crash recovery.
 * On startup, recovers in-progress tasks back into the queue.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import type { MemoryAttribution, ResponseTier, Task } from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';

import type { ActivityFeed } from '../activity/index.js';
import type { AgenticCompletionOptions, AIProvider } from '../ai/copilot-provider.js';
import { MemoryExtractor } from '../memory/memory-extractor.js';
import { MemoryRecallEngine } from '../memory/memory-recall.js';
import { MemoryStore } from '../memory/memory-store.js';
import { getTierDefinition, selectTier } from '../routing/tiers.js';
import {
  buildSkillsPrompt,
  getSkillsForRole,
  loadSkillsFromDirectory,
  matchSkillsForTask,
  type ParsedSkill,
} from '../seed-skills.js';
import { createTask, getTask, updateTask } from '../squad-writer/task-writer.js';
import type { WebSocketManager } from '../websocket/index.js';
import type { WorktreeService, WorktreeInfo } from '../worktree/index.js';

// ── Types ────────────────────────────────────────────────────────

interface AgentProfile {
  id: string;
  name: string;
  role: string;
  personality: string;
}

interface AgentWorkerConfig {
  tasksDir: string;
  squadDir: string;
  /** Path to persist queue state. Default: <tasksDir>/../.cache/agent-queue.json */
  queueFilePath?: string;
  aiProvider: AIProvider;
  activityFeed: ActivityFeed;
  wsManager: WebSocketManager | null;
  agents: AgentProfile[];
  pollIntervalMs?: number;
  /** SQLite database instance for memory store. */
  db?: Database;
  /**
   * Base URL for the A2A service (e.g. http://localhost:3001).
   * When set, enables inter-agent delegation via A2A protocol.
   */
  a2aBaseUrl?: string | null;
  /** WorktreeService for sandboxed parallel execution. */
  worktreeService?: WorktreeService | null;
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
  private allSkills: ParsedSkill[] = [];
  private recallEngine: MemoryRecallEngine | null = null;
  private recallEngineInitialized = false;

  constructor(config: AgentWorkerConfig) {
    this.config = config;
    this.queueFilePath =
      config.queueFilePath ?? join(config.tasksDir, '..', '.cache', 'agent-queue.json');

    for (const agent of config.agents) {
      this.queues.set(agent.id, []);
    }

    // Load skills from .squad/skills/
    try {
      const skillsDir = join(config.tasksDir, '..', 'skills');
      this.allSkills = loadSkillsFromDirectory(skillsDir);
      console.log(`[AgentWorker] Loaded ${this.allSkills.length} skills`);
    } catch {
      this.allSkills = [];
    }
  }

  /** Lazily initialize the MemoryRecallEngine (ensures DB schema exists). */
  private async ensureRecallEngine(): Promise<MemoryRecallEngine | null> {
    if (this.recallEngineInitialized) return this.recallEngine;
    this.recallEngineInitialized = true;

    const db = this.config.db;
    if (!db) return null;

    try {
      const { hasMemorySchema, initializeMemorySchema } =
        await import('@matanelcohen/openspace-memory-store');
      if (!hasMemorySchema(db)) initializeMemorySchema(db);

      const memoryStore = new MemoryStore(db);
      this.recallEngine = new MemoryRecallEngine(memoryStore, { maxMemories: 10 });
      console.log('[AgentWorker] Memory recall engine initialized');
      return this.recallEngine;
    } catch (err) {
      console.warn(
        '[AgentWorker] Memory recall engine unavailable:',
        err instanceof Error ? err.message : err,
      );
      return null;
    }
  }

  /** Add a task to the assigned agent's queue. */
  /** Tasks that should skip delegation (manually assigned). */
  private readonly skipDelegation = new Set<string>();

  enqueue(task: Task, opts?: { skipDelegation?: boolean }): void {
    if (!task.assignee) return;
    const queue = this.queues.get(task.assignee);
    if (!queue) return;

    if (queue.includes(task.id) || this.activeTask.get(task.assignee) === task.id) return;

    if (opts?.skipDelegation) {
      this.skipDelegation.add(task.id);
    }

    queue.push(task.id);
    this.persistQueue();
    console.log(`[AgentWorker] Queued ${task.id} for ${task.assignee} (queue: ${queue.length}${opts?.skipDelegation ? ', no-delegate' : ''})`);

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

  /** Return the configured agent profiles. */
  getAgents(): AgentProfile[] {
    return [...this.config.agents];
  }

  /** Return a shallow copy of each agent's queued task IDs. */
  getQueuedTaskIds(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const agent of this.config.agents) {
      result[agent.id] = [...(this.queues.get(agent.id) ?? [])];
    }
    return result;
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
              // Too many retries — mark as blocked permanently with reason
              const lastError =
                task.description.match(/\*\*Error:\*\*\s*(.+)/g)?.pop() ??
                'Unknown — server likely crashed before error could be captured';
              await updateTask(this.config.tasksDir, taskId, {
                status: 'blocked',
                description:
                  task.description +
                  `\n\n---\n**[${new Date().toISOString().replace('T', ' ').substring(0, 19)}]** 🛑 Permanently blocked after ${retryCount} failed attempts.\n\n**Last known error:** ${lastError}\n\n**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.`,
              });
              // Remove from queue to prevent infinite retry loop
              if (queue) {
                const idx = queue.indexOf(task.id);
                if (idx >= 0) queue.splice(idx, 1);
              }
              console.log(
                `[AgentWorker] Task ${taskId} permanently blocked after ${retryCount} retries — removed from queue`,
              );
              continue;
            }

            if (!isAlreadyQueued && !isActive) {
              await updateTask(this.config.tasksDir, taskId, { status: 'pending' });
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

      // Skip tasks that are already blocked (shouldn't be in queue but safety check)
      if (task.status === 'blocked') {
        console.log(`[AgentWorker] Skipping blocked task ${taskId}`);
        this.activeTask.delete(agentId);
        this.persistQueue();
        setTimeout(() => this.processNext(agentId), 1000);
        return;
      }

      // Check retry count — don't even start if too many retries
      const retryCount = (task.description.match(/🚀.*started working/g) ?? []).length;
      if (retryCount >= 5) {
        console.log(`[AgentWorker] Task ${taskId} has ${retryCount} retries — marking blocked`);
        await updateTask(this.config.tasksDir, taskId, {
          status: 'blocked',
          description:
            task.description +
            `\n\n---\n**[${new Date().toISOString().replace('T', ' ').substring(0, 19)}]** 🛑 Permanently blocked after ${retryCount} failed attempts.`,
        });
        this.activeTask.delete(agentId);
        this.persistQueue();
        setTimeout(() => this.processNext(agentId), 1000);
        return;
      }

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
      this.broadcastAgentWorking(agentId, taskId, task.title);
      this.emitActivity(agentId, 'started', `Started working on: ${task.title}`);
      this.persistQueue();

      console.log(`[AgentWorker] ${agent.name} started: ${task.title}`);

      // ── Select response tier based on task complexity ──
      const tier = selectTier({
        title: task.title,
        description: task.description,
        priority: task.priority,
      });
      const tierDef = getTierDefinition(tier);
      console.log(
        `[AgentWorker] Response tier: ${tier} (${tierDef.description}) for task ${taskId}`,
      );

      // Log tier in task description for traceability
      await updateTask(this.config.tasksDir, taskId, {
        description:
          task.description +
          `\n\n---\n**[${now()}]** 🚀 ${agent.name} started working on this task.\n**[${now()}]** 🎚️ Response tier: **${tier}** — ${tierDef.description} (maxAgents: ${tierDef.maxAgents})`,
      });

      // ── Lead delegation: break down task and assign to team ──
      // Lead agents always delegate complex tasks (even manual assignments).
      // Non-lead agents always execute directly.
      const isLead =
        agent.role.toLowerCase().includes('lead') || agent.role.toLowerCase().includes('architect');
      const isComplex = (task.description?.length ?? 0) > 200;
      const shouldSkipDelegation = this.skipDelegation.has(taskId);
      if (shouldSkipDelegation) this.skipDelegation.delete(taskId);

      if (isLead && isComplex) {
        await this.handleLeadDelegation(agent, task, taskId, tier);
        return;
      }

      // ── Regular agent: execute the task directly ──
      // Collect progress events during execution
      const progressLog: string[] = [];

      // Build task-matched skills prompt (SDK-style: matches by task content + role + domain)
      const taskText = `${task.title} ${task.description ?? ''}`;
      const autoMatched = matchSkillsForTask(this.allSkills, taskText, agent.role);
      const matched =
        autoMatched.length > 0 ? autoMatched : getSkillsForRole(this.allSkills, agent.role);

      // Apply per-agent overrides (always/never) from .cache/agent-skill-overrides.json
      let finalSkills = matched;
      try {
        const { existsSync, readFileSync } = await import('node:fs');
        const { join } = await import('node:path');
        const overridesPath = join(this.config.squadDir, '.cache', 'agent-skill-overrides.json');
        if (existsSync(overridesPath)) {
          const overrides = JSON.parse(readFileSync(overridesPath, 'utf-8')) as Record<
            string,
            Record<string, string>
          >;
          const agentOverrides = overrides[agent.id] ?? {};
          // Remove 'never' skills
          finalSkills = finalSkills.filter((s) => agentOverrides[s.id] !== 'never');
          // Add 'always' skills not already included
          const includedIds = new Set(finalSkills.map((s) => s.id));
          for (const [skillId, mode] of Object.entries(agentOverrides)) {
            if (mode === 'always' && !includedIds.has(skillId)) {
              const skill = this.allSkills.find((s) => s.id === skillId);
              if (skill) finalSkills.push(skill);
            }
          }
        }
      } catch {
        /* ignore override errors */
      }

      const skillsPrompt = buildSkillsPrompt(finalSkills);

      // Retrieve relevant memories via MemoryRecallEngine (FTS5 + strength + recency scoring)
      let memoriesPrompt = '';
      let memoryAttributions: MemoryAttribution[] = [];
      try {
        const engine = await this.ensureRecallEngine();
        if (engine) {
          const recallResults = engine.recall(agent.id, taskText);
          if (recallResults.length > 0) {
            const contextBlock = engine.buildContextBlock(recallResults);
            if (contextBlock) {
              memoriesPrompt = `## Your Memories & Learnings\n\n${contextBlock}\n\n`;
            }
            memoryAttributions = engine.buildAttributions(recallResults);
          }
        }
      } catch {
        /* best effort — memory recall is non-critical */
      }

      // ── Build shared event handler ────────────────────────────────
      const onEvent = (event: { type: string; data?: Record<string, unknown> }) => {
        const ts = new Date().toISOString().replace('T', ' ').substring(0, 19);
        let logEntry = '';

        switch (event.type) {
          case 'intent':
            logEntry = `🎯 Intent: ${(event.data?.intent as string) ?? 'analyzing'}`;
            break;
          case 'thinking':
            logEntry = `🧠 Thinking: ${((event.data?.content as string) ?? '').substring(0, 200)}`;
            break;
          case 'tool_start': {
            const toolName = (event.data?.name as string) ?? 'unknown';
            const toolArgs = event.data?.arguments;
            let argSummary = '';
            if (typeof toolArgs === 'string') {
              argSummary = toolArgs.substring(0, 120);
            } else if (toolArgs && typeof toolArgs === 'object') {
              const argObj = toolArgs as Record<string, unknown>;
              if (argObj.command) argSummary = ` — \`${String(argObj.command).substring(0, 100)}\``;
              else if (argObj.path) argSummary = ` — ${String(argObj.path)}`;
              else argSummary = ` — ${JSON.stringify(toolArgs).substring(0, 100)}`;
            }
            logEntry = `🔧 Using tool: \`${toolName}\`${argSummary}`;
            break;
          }
          case 'tool_result':
            logEntry = `✅ Tool result: ${((event.data?.output as string) ?? '').substring(0, 150)}`;
            break;
          case 'info':
            logEntry = `ℹ️ ${(event.data?.message as string) ?? ''}`;
            break;
        }

        if (logEntry) {
          progressLog.push(`**[${ts}]** ${logEntry}`);
          // Broadcast progress in real-time with enriched payload
          const payload: Record<string, unknown> = {
            id: taskId,
            taskId,
            agentId,
            progressEvent: event.type,
            progressMessage: logEntry,
          };

          // Enrich WebSocket events with structured data
          if (event.type === 'tool_start' && event.data) {
            payload.tool_name = event.data.name;
            payload.tool_args = event.data.arguments;
            if (event.data.arguments && typeof event.data.arguments === 'object') {
              const args = event.data.arguments as Record<string, unknown>;
              if (args.command) payload.command = args.command;
              if (args.path) payload.file_path = args.path;
            }
          }
          if (event.type === 'tool_result' && event.data) {
            payload.tool_output = ((event.data.output as string) ?? '').substring(0, 500);
          }

          this.config.wsManager?.broadcast({
            type: 'task:updated',
            payload,
            timestamp: new Date().toISOString(),
          });
        }
      };

      // ── AI completion — prefer agentic mode when available ──────
      const systemPrompt =
        `You are ${agent.name}, the ${agent.role} of the openspace.ai squad. ` +
        `Personality: ${agent.personality}\n\n` +
        `You have been assigned a task. Execute it fully — write code, create files, make changes. ` +
        `Do the actual work, don't just describe what you would do.\n\n` +
        `RULES:\n` +
        `- Do NOT create or modify files in .squad/ — it is managed by the system.\n` +
        `- Only modify files under apps/, packages/, src/, or other project source directories.\n` +
        `- Complete the task in a single pass. Do not create sub-tasks.\n\n` +
        (memoriesPrompt ? `${memoriesPrompt}\n` : '') +
        (skillsPrompt ? `${skillsPrompt}\n\n` : '') +
        `When done, provide a brief summary of what you did.`;

      const messages = [
        {
          role: 'user' as const,
          content: `Task: ${task.title}\n\nDescription: ${task.description || '(none)'}\n\nPriority: ${task.priority}\n\nPlease complete this task.`,
        },
      ];

      const sharedOpts = {
        taskTitle: task.title,
        agentId: agent.id,
        metadata: {
          skills: finalSkills.map((s) => s.id),
          skillCount: finalSkills.length,
          memoryCount: memoryAttributions.length,
          memoryAttributions: memoryAttributions.length > 0 ? memoryAttributions : undefined,
        },
        systemPrompt,
        messages,
        onEvent,
      };

      let result;
      let worktree: WorktreeInfo | null = null;
      if (this.config.aiProvider.agenticCompletion) {
        // Determine working directory: use worktree sandbox if available
        let workDir: string;
        const wts = this.config.worktreeService;
        if (wts) {
          const parentId = task.labels
            ?.find((l) => l.startsWith('parent:'))
            ?.replace('parent:', '');
          worktree = await wts.create(taskId, {
            baseBranch: parentId ? `feature/${parentId}` : undefined,
            parentTaskId: parentId ?? undefined,
          });
          workDir = worktree.path;
          console.log(`[AgentWorker] ${agent.name} using sandbox: ${worktree.branch} → ${workDir}`);
        } else {
          workDir = join(this.config.squadDir, '..');
        }

        console.log(`[AgentWorker] ${agent.name} using agentic mode in ${workDir}`);
        result = await this.config.aiProvider.agenticCompletion({
          ...sharedOpts,
          workingDirectory: workDir,
          metadata: {
            ...sharedOpts.metadata,
            agentic: true,
            branch: worktree?.branch,
            sandbox: !!worktree,
          },
        } satisfies AgenticCompletionOptions);
      } else {
        // Fallback: single-shot chat completion (mock provider)
        result = await this.config.aiProvider.chatCompletion(sharedOpts);
      }

      // Auto-commit + PR if worktree sandbox was used
      let prInfo: { number: number; url: string } | undefined;
      if (worktree && this.config.worktreeService) {
        const wts = this.config.worktreeService;
        if (wts.autoCommit) {
          const sha = await wts.commit(taskId, `feat: ${task.title}\n\nTask: ${taskId}\nAgent: ${agent.name}`);
          if (sha && wts.autoPR) {
            try {
              prInfo = await wts.createPR(taskId, {
                title: task.title,
                body: `Automated by **${agent.name}** (${agent.role})\n\n**Task:** ${taskId}\n\n${result.content.substring(0, 500)}`,
              });
            } catch (err) {
              console.warn(`[AgentWorker] PR creation failed for ${taskId}:`, err);
            }
          }
        }
      }

      const progressSection =
        progressLog.length > 0 ? `\n\n**Progress:**\n${progressLog.join('\n')}` : '';
      const branchSection = worktree
        ? `\n**Branch:** \`${worktree.branch}\`` +
          (prInfo ? ` | **PR:** [#${prInfo.number}](${prInfo.url})` : '')
        : '';

      await updateTask(this.config.tasksDir, taskId, {
        status: 'done',
        labels: prInfo ? [...(task.labels ?? []), `pr:${prInfo.number}`] : task.labels,
        description:
          task.description +
          `\n\n---\n**[${now()}]** 🚀 ${agent.name} started working on this task.` +
          progressSection +
          branchSection +
          `\n\n**[${now()}]** ✅ ${agent.name} completed this task.\n\n**Result:**\n${result.content}`,
      });
      this.broadcastTaskUpdate(taskId, 'done');
      this.emitActivity(
        agentId,
        'completed',
        `Completed: ${task.title} — ${result.content.substring(0, 100)}`,
      );

      console.log(`[AgentWorker] ${agent.name} completed: ${task.title}`);

      // Extract and save memories from this task using LLM-based extraction
      try {
        const { hasMemorySchema, initializeMemorySchema, MemoryStoreService } =
          await import('@matanelcohen/openspace-memory-store');
        const db = this.config.db;
        if (db) {
          if (!hasMemorySchema(db)) initializeMemorySchema(db);
          const memStore = new MemoryStoreService(db, {});

          // Try LLM-based extraction first
          let savedCount = 0;
          try {
            const extractor = new MemoryExtractor(this.config.aiProvider);
            const extracted = await extractor.extract({
              agentId: agent.id,
              taskId,
              taskTitle: task.title,
              taskDescription: task.description,
              resultContent: result.content,
              progressLog,
            });

            for (const mem of extracted) {
              await memStore.create({
                agentId: agent.id,
                type: mem.type,
                content: mem.content,
                sourceSession: `task-${taskId}`,
                sourceTaskId: taskId,
                tags: ['task-extraction'],
              });
              savedCount++;
            }
          } catch {
            // LLM extraction failed — fallback to simple summary save
          }

          // Always save a task-completion summary as baseline
          const summary = result.content.substring(0, 500);
          await memStore.create({
            agentId: agent.id,
            type: 'pattern',
            content: `Completed "${task.title}": ${summary}`,
            sourceSession: `task-${taskId}`,
            sourceTaskId: taskId,
            tags: ['task-completion'],
          });

          if (savedCount > 0) {
            console.log(`[AgentWorker] Extracted ${savedCount} memories from task ${taskId}`);
          }

          // Write new memories back to agent's history.md
          try {
            await this.syncMemoriesToHistory(agent.id, memStore);
          } catch {
            /* best effort */
          }
        }
      } catch {
        /* best effort */
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack?.substring(0, 500) : '';
      console.error(`[AgentWorker] ${agentId} failed on ${taskId}:`, message);

      // Persist error to a crash-safe log file (survives server restarts)
      try {
        const logDir = dirname(this.queueFilePath);
        if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
        const logLine = `[${new Date().toISOString()}] ${agentId} | ${taskId} | ${message}\n`;
        appendFileSync(join(logDir, 'agent-errors.log'), logLine, 'utf-8');
      } catch {
        /* best effort */
      }

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
      // Broadcast idle if the agent has no more queued tasks
      if ((this.queues.get(agentId)?.length ?? 0) === 0) {
        this.broadcastAgentIdle(agentId);
      }
      // Wait before picking next task to let resources settle
      setTimeout(() => this.processNext(agentId), 3000);
    }
  }

  // ── History.md Writeback ────────────────────────────────────────

  /**
   * Sync memories from the store back to the agent's history.md file.
   * Appends new memories that aren't already present in the file.
   */
  private async syncMemoriesToHistory(
    agentId: string,
    memStore: { list: (agentId: string, limit?: number) => Array<{ content: string; type: string; createdAt: string }> },
  ): Promise<void> {
    const agentsDir = join(this.config.squadDir, 'agents');
    const historyPath = join(agentsDir, agentId, 'history.md');

    if (!existsSync(historyPath)) return;

    const content = readFileSync(historyPath, 'utf-8');

    // Get all enabled memories for this agent
    const memories = memStore.list(agentId, 1000);
    if (memories.length === 0) return;

    // Find existing learning entries to avoid duplicates
    const existingEntries = new Set<string>();
    const learningsMatch = content.match(/^##\s+Learnings\b/im);
    if (learningsMatch && learningsMatch.index !== undefined) {
      const afterLearnings = content.slice(learningsMatch.index + learningsMatch[0].length);
      const nextSection = afterLearnings.match(/^##\s+/m);
      const learningsContent = nextSection?.index
        ? afterLearnings.slice(0, nextSection.index)
        : afterLearnings;

      for (const line of learningsContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('- ')) {
          existingEntries.add(trimmed.slice(2).trim());
        }
      }
    }

    // Find new memories not yet in history.md
    const newEntries: string[] = [];
    for (const mem of memories) {
      if (!existingEntries.has(mem.content) && !existingEntries.has(`**${mem.content}**`)) {
        // Check if any existing entry contains this content (fuzzy match for already-formatted entries)
        const alreadyExists = [...existingEntries].some(
          (e) => e.includes(mem.content) || mem.content.includes(e),
        );
        if (!alreadyExists) {
          newEntries.push(`- ${mem.content}`);
        }
      }
    }

    if (newEntries.length === 0) return;

    // Append new entries to the Learnings section
    if (learningsMatch && learningsMatch.index !== undefined) {
      const afterLearnings = content.slice(learningsMatch.index + learningsMatch[0].length);
      const nextSection = afterLearnings.match(/^##\s+/m);

      if (nextSection?.index !== undefined) {
        // Insert before next section
        const insertPoint = learningsMatch.index + learningsMatch[0].length + nextSection.index;
        const updated =
          content.slice(0, insertPoint).trimEnd() +
          '\n' +
          newEntries.join('\n') +
          '\n\n' +
          content.slice(insertPoint);
        writeFileSync(historyPath, updated, 'utf-8');
      } else {
        // Append at end
        const updated = content.trimEnd() + '\n' + newEntries.join('\n') + '\n';
        writeFileSync(historyPath, updated, 'utf-8');
      }
    } else {
      // No Learnings section — add one
      const updated = content.trimEnd() + '\n\n## Learnings\n\n' + newEntries.join('\n') + '\n';
      writeFileSync(historyPath, updated, 'utf-8');
    }

    console.log(`[AgentWorker] Wrote ${newEntries.length} memories to ${agentId}/history.md`);
  }

  // ── Lead Delegation ──────────────────────────────────────────────

  /**
   * When a lead agent gets a complex task, they break it down into sub-tasks
   * and assign them to the right team members instead of doing the work themselves.
   * The tier controls how many agents get delegated to.
   * After all subtasks complete, the parent task is summarized and marked done.
   */
  private async handleLeadDelegation(
    agent: AgentProfile,
    task: Task,
    taskId: string,
    tier: ResponseTier = 'standard',
  ): Promise<void> {
    const now = () => new Date().toISOString().replace('T', ' ').substring(0, 19);
    const tierDef = getTierDefinition(tier);
    const otherAgents = this.config.agents.filter(
      (a) => a.id !== agent.id && !['scribe', 'ralph'].includes(a.id),
    );
    const agentList = otherAgents.map((a) => `- ${a.id}: ${a.name} (${a.role})`).join('\n');

    // Tier-based delegation constraints
    const maxSubTasks =
      tier === 'full'
        ? otherAgents.length
        : tier === 'standard'
          ? Math.min(3, otherAgents.length)
          : 1;

    // Recall relevant memories to inform delegation decisions
    let memoryContext = '';
    try {
      const engine = await this.ensureRecallEngine();
      if (engine) {
        const taskText = `${task.title} ${task.description ?? ''}`;
        const recallResults = engine.recall(agent.id, taskText);
        const block = engine.buildContextBlock(recallResults);
        if (block) {
          memoryContext = `\n${block}\n\n`;
        }
      }
    } catch {
      /* best effort */
    }

    try {
      const result = await this.config.aiProvider.chatCompletion({
        taskTitle: task.title,
        agentId: agent.id,
        systemPrompt:
          `You are ${agent.name}, the Lead of the openspace.ai squad.\n` +
          `Your job is to break down tasks and delegate to the right team members.\n\n` +
          (memoryContext ? memoryContext : '') +
          `Response tier: ${tier} (${tierDef.description}). Max agents: ${tierDef.maxAgents}.\n\n` +
          `Available team members:\n${agentList}\n\n` +
          `Respond ONLY with valid JSON — an array of 2-4 sub-tasks:\n` +
          `[{"title": "...", "description": "...", "assignee": "agent_id"}]\n\n` +
          `Rules:\n` +
          `- Break the task into 2-${Math.min(4, maxSubTasks)} focused sub-tasks\n` +
          `- Assign frontend work to the Frontend Dev\n` +
          `- Assign backend/API work to the Backend Dev\n` +
          `- Assign testing to the Tester\n` +
          `- Each sub-task should be specific and actionable\n` +
          `- Output ONLY the JSON array, nothing else`,
        messages: [
          {
            role: 'user',
            content: `Break down this task and assign to team:\n\nTitle: ${task.title}\nDescription: ${task.description || '(none)'}\nPriority: ${task.priority}`,
          },
        ],
      });

      // Parse sub-tasks from AI response
      let subTasks: Array<{ title: string; description: string; assignee: string }> = [];
      try {
        const jsonMatch = result.content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          subTasks = JSON.parse(jsonMatch[0]);
        }
      } catch {
        console.error(`[AgentWorker] ${agent.name} failed to parse sub-tasks JSON`);
      }

      if (subTasks.length === 0) {
        // Fallback: couldn't break down, mark done with the AI's response
        await updateTask(this.config.tasksDir, taskId, {
          status: 'done',
          description:
            task.description +
            `\n\n---\n**[${now()}]** 📋 ${agent.name} analyzed this task but couldn't break it down.\n\n**Analysis:**\n${result.content}`,
        });
        this.broadcastTaskUpdate(taskId, 'done');
        return;
      }

      // Create sub-tasks and enqueue them
      // Create feature branch for sandbox isolation if worktree service available
      const wts = this.config.worktreeService;
      let featureBranch: string | undefined;
      if (wts) {
        featureBranch = await wts.ensureFeatureBranch(taskId);
        console.log(`[AgentWorker] Created feature branch: ${featureBranch} for delegation`);
      }

      const createdSubTasks: string[] = [];
      const subtaskIds: string[] = [];
      for (const sub of subTasks) {
        const validAssignee = otherAgents.find((a) => a.id === sub.assignee);
        if (!validAssignee) continue;

        const subTask = await createTask(this.config.tasksDir, {
          title: sub.title,
          description: sub.description,
          priority: task.priority,
          assignee: sub.assignee,
          status: 'pending',
          labels: [`parent:${taskId}`],
          parent: taskId,
        });

        this.enqueue(subTask);
        createdSubTasks.push(`- **${sub.title}** → ${validAssignee.name} (${validAssignee.role})`);
        subtaskIds.push(subTask.id);

        // Broadcast subtask created event
        this.config.wsManager?.broadcast({
          type: 'task:subtask_created',
          payload: {
            parentTaskId: taskId,
            subtaskId: subTask.id,
            title: subTask.title,
            assignee: sub.assignee,
            assigneeName: validAssignee.name,
          },
          timestamp: new Date().toISOString(),
        });

        console.log(
          `[AgentWorker] ${agent.name} delegated "${sub.title}" to ${validAssignee.name}`,
        );
      }

      // Mark parent task as "delegated" with delegation summary
      const summary = createdSubTasks.join('\n');
      const branchInfo = featureBranch ? `\n**Feature Branch:** \`${featureBranch}\`\n` : '';
      await updateTask(this.config.tasksDir, taskId, {
        status: 'delegated',
        description:
          task.description +
          `\n\n---\n**[${now()}]** 📋 ${agent.name} broke this task into ${createdSubTasks.length} sub-tasks:\n\n${summary}${branchInfo}\n\n**[${now()}]** 🔀 Task delegated — waiting for subtask completion.`,
      });

      // Broadcast delegation event
      this.config.wsManager?.broadcast({
        type: 'task:delegated',
        payload: {
          taskId,
          title: task.title,
          agentId: agent.id,
          agentName: agent.name,
          subtaskCount: createdSubTasks.length,
          subtaskIds,
        },
        timestamp: new Date().toISOString(),
      });
      this.broadcastTaskUpdate(taskId, 'delegated');
      this.emitActivity(
        agent.id,
        'completed',
        `Delegated: ${task.title} → ${createdSubTasks.length} sub-tasks`,
      );

      console.log(
        `[AgentWorker] ${agent.name} delegated ${createdSubTasks.length} sub-tasks for: ${task.title}`,
      );

      // Start monitoring subtask completion in the background
      this.monitorSubtaskCompletion(agent, taskId, subtaskIds);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[AgentWorker] ${agent.name} delegation failed:`, message);

      await updateTask(this.config.tasksDir, taskId, {
        status: 'blocked',
        description:
          task.description +
          `\n\n---\n**[${now()}]** ❌ ${agent.name} failed to delegate.\n\n**Error:** ${message}`,
      });
      this.broadcastTaskUpdate(taskId, 'blocked');
    } finally {
      this.activeTask.delete(agent.id);
      this.persistQueue();
      if ((this.queues.get(agent.id)?.length ?? 0) === 0) {
        this.broadcastAgentIdle(agent.id);
      }
      setTimeout(() => this.processNext(agent.id), 3000);
    }
  }

  /**
   * Periodically check whether all subtasks for a delegated parent task are done.
   * When all are complete, summarize results and mark the parent as done.
   */
  private monitorSubtaskCompletion(
    agent: AgentProfile,
    parentTaskId: string,
    subtaskIds: string[],
  ): void {
    const checkInterval = setInterval(async () => {
      try {
        const subtasks = await Promise.all(
          subtaskIds.map((id) => getTask(this.config.tasksDir, id).catch(() => null)),
        );
        const resolved = subtasks.filter((t): t is Task => t !== null);
        const allDone =
          resolved.length === subtaskIds.length && resolved.every((t) => t.status === 'done');
        const anyBlocked = resolved.some((t) => t.status === 'blocked');

        if (allDone) {
          clearInterval(checkInterval);
          const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
          const completionSummary = resolved
            .map((t) => `- **${t.title}** (${t.assignee ?? 'unassigned'}): ✅ Done`)
            .join('\n');

          const parentTask = await getTask(this.config.tasksDir, parentTaskId).catch(() => null);
          if (!parentTask) return;

          // Create consolidated PR from feature branch → main
          let featurePrInfo: { number: number; url: string } | null = null;
          const wts = this.config.worktreeService;
          if (wts) {
            try {
              featurePrInfo = await wts.createFeaturePR(parentTaskId, {
                title: `[Delegated] ${parentTask.title}`,
                body: `## Delegated Task\n\n**Lead:** ${agent.name}\n\n### Subtasks\n${completionSummary}`,
              });
              // Clean up all subtask worktrees
              await wts.cleanupDelegation(parentTaskId, subtaskIds);
            } catch (err) {
              console.warn(`[AgentWorker] Feature PR/cleanup failed:`, err);
            }
          }

          const prSection = featurePrInfo
            ? `\n**PR:** [#${featurePrInfo.number}](${featurePrInfo.url})`
            : '';

          await updateTask(this.config.tasksDir, parentTaskId, {
            status: 'done',
            labels: featurePrInfo
              ? [...(parentTask.labels ?? []), `pr:${featurePrInfo.number}`]
              : parentTask.labels,
            description:
              parentTask.description +
              `\n\n---\n**[${now}]** ✅ All ${resolved.length} subtasks completed.\n\n${completionSummary}${prSection}\n\n**[${now}]** ✅ ${agent.name} marked parent task as done.`,
          });
          this.broadcastTaskUpdate(parentTaskId, 'done');
          this.emitActivity(agent.id, 'completed', `All subtasks done for: ${parentTask.title}`);

          // Broadcast subtask completed events
          for (const st of resolved) {
            this.config.wsManager?.broadcast({
              type: 'task:subtask_completed',
              payload: {
                parentTaskId,
                subtaskId: st.id,
                title: st.title,
                assignee: st.assignee,
              },
              timestamp: new Date().toISOString(),
            });
          }
        } else if (anyBlocked) {
          // If any subtask is blocked, keep monitoring — don't stop
          // (the user may retry the blocked subtask)
          const blockedTasks = resolved.filter((t) => t.status === 'blocked');
          console.log(
            `[AgentWorker] Parent ${parentTaskId}: ${blockedTasks.length} subtask(s) blocked, still monitoring`,
          );
        }
      } catch (err) {
        console.error(`[AgentWorker] Error monitoring subtasks for ${parentTaskId}:`, err);
      }
    }, 10_000); // Check every 10 seconds

    // Safety: stop monitoring after 30 minutes
    setTimeout(() => clearInterval(checkInterval), 30 * 60 * 1000);
  }

  // ── Broadcasting ───────────────────────────────────────────────

  private broadcastTaskUpdate(taskId: string, status: string): void {
    this.config.wsManager?.broadcast({
      type: 'task:updated',
      payload: { id: taskId, taskId, status },
      timestamp: new Date().toISOString(),
    });
  }

  private broadcastAgentWorking(agentId: string, taskId: string, taskTitle: string): void {
    this.config.wsManager?.broadcast({
      type: 'agent:working',
      payload: { agentId, taskId, taskTitle },
      timestamp: new Date().toISOString(),
    });
  }

  private broadcastAgentIdle(agentId: string): void {
    this.config.wsManager?.broadcast({
      type: 'agent:idle',
      payload: { agentId },
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

  // ── A2A Delegation (Tasks → A2A bridge) ───────────────────────

  /**
   * Delegate a message to another agent via the A2A protocol.
   *
   * This enables inter-agent communication: one agent can ask another
   * to perform work by sending an A2A message. The recipient agent
   * processes it through its SquadAgentExecutor, which also bridges
   * back to chat and activity.
   *
   * Returns the agent response text, or null if delegation is unavailable.
   */
  async delegateToAgent(
    targetAgentId: string,
    message: string,
    contextId?: string,
  ): Promise<string | null> {
    const baseUrl = this.config.a2aBaseUrl;
    if (!baseUrl) {
      console.warn('[AgentWorker] A2A delegation unavailable — no a2aBaseUrl configured');
      return null;
    }

    try {
      // Dynamically import the A2A client to avoid bundling it when unused
      const { A2AClient } = await import('@a2a-js/sdk/client');

      const agentCardUrl = `${baseUrl}/a2a/${targetAgentId}`;
      const client = new A2AClient(agentCardUrl);

      const result = await client.sendMessage({
        message: {
          kind: 'message',
          messageId: `delegate-${Date.now()}`,
          role: 'user',
          parts: [{ kind: 'text', text: message }],
          contextId: contextId ?? `delegation-${Date.now()}`,
        },
      });

      // Extract text from the response
      const responseResult = result as {
        result?: { status?: { message?: { parts?: Array<{ kind: string; text?: string }> } } };
      };
      const parts = responseResult?.result?.status?.message?.parts ?? [];
      const responseText = parts
        .filter((p: { kind: string; text?: string }) => p.kind === 'text' && p.text)
        .map((p: { kind: string; text?: string }) => p.text)
        .join('\n');

      this.emitActivity(
        targetAgentId,
        'completed',
        `Received delegated work via A2A: ${message.substring(0, 80)}`,
      );

      return responseText || null;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[AgentWorker] A2A delegation to ${targetAgentId} failed:`, errorMsg);
      this.emitActivity(
        targetAgentId,
        'failed',
        `A2A delegation failed: ${errorMsg.substring(0, 80)}`,
      );
      return null;
    }
  }
}
