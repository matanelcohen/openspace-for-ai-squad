/**
 * Cron Scheduler — runs scheduled jobs defined in `.squad/cron.json`.
 *
 * Checks every 60 seconds whether any job is due. For "chat" actions it
 * sends a message via ChatService. For "task" actions it creates a task
 * file in `.squad/tasks/`. Logs all executions.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ChatService } from '../chat/index.js';

// ── Types ─────────────────────────────────────────────────────────

export interface CronJob {
  id: string;
  schedule: string;
  agent: string;
  action: 'chat' | 'task';
  /** Message content (for chat actions). */
  message?: string;
  /** Channel/recipient (for chat actions, defaults to "team"). */
  channel?: string;
  /** Task title (for task actions). */
  title?: string;
  /** Task description (for task actions). */
  description?: string;
  enabled: boolean;
  // ── Ceremony fields (Phase 5: Squad SDK) ──
  /** Which agents participate in this ceremony. */
  participants?: string[];
  /** Structured agenda text for ceremonies. */
  agenda?: string;
  /** Ceremony type for template selection. */
  type?: 'standup' | 'retro' | 'custom';
}

export interface CronConfig {
  jobs: CronJob[];
}

interface CronExecution {
  jobId: string;
  executedAt: string;
  result: 'success' | 'error';
  error?: string;
}

// ── Cron expression parser ────────────────────────────────────────

/**
 * Check if the current time matches a cron expression.
 * Supports: minute hour dayOfMonth month dayOfWeek
 * Supports: *, ranges (1-5), and specific values.
 */
function matchesCron(schedule: string, now: Date): boolean {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = parts;

  return (
    matchField(minExpr!, now.getMinutes()) &&
    matchField(hourExpr!, now.getHours()) &&
    matchField(domExpr!, now.getDate()) &&
    matchField(monExpr!, now.getMonth() + 1) &&
    matchField(dowExpr!, now.getDay())
  );
}

function matchField(expr: string, value: number): boolean {
  if (expr === '*') return true;

  // Handle comma-separated values: "1,3,5"
  for (const part of expr.split(',')) {
    // Handle ranges: "1-5"
    if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      if (value >= lo! && value <= hi!) return true;
    }
    // Handle step values: "*/5"
    else if (part.includes('/')) {
      const [base, step] = part.split('/');
      const stepNum = Number(step);
      if (
        stepNum > 0 &&
        (base === '*' ? value % stepNum === 0 : (value - Number(base)) % stepNum === 0)
      ) {
        return true;
      }
    }
    // Exact match
    else if (Number(part) === value) {
      return true;
    }
  }

  return false;
}

// ── Cron Service ──────────────────────────────────────────────────

export class CronService {
  private jobs: CronJob[] = [];
  private readonly configPath: string;
  private readonly ceremoniesPath: string;
  private readonly tasksDir: string;
  private interval: ReturnType<typeof setInterval> | null = null;
  private chatService: ChatService | null = null;
  private readonly executions: CronExecution[] = [];
  private lastCheckMinute = -1;

  constructor(opts: { squadDir: string }) {
    this.configPath = join(opts.squadDir, 'cron.json');
    this.tasksDir = join(opts.squadDir, 'tasks');
    this.ceremoniesPath = join(opts.squadDir, 'ceremonies.json');
  }

  /** Load jobs from .squad/cron.json or .squad/ceremonies.json. */
  loadConfig(): void {
    // Try ceremonies.json first, fall back to cron.json
    const configFile = existsSync(this.ceremoniesPath) ? this.ceremoniesPath : this.configPath;

    if (!existsSync(configFile)) {
      console.log('[Cron] No cron.json or ceremonies.json found — scheduler disabled');
      return;
    }

    try {
      const raw = readFileSync(configFile, 'utf-8');
      const config = JSON.parse(raw) as CronConfig;
      this.jobs = config.jobs ?? [];
      console.log(
        `[Cron] Loaded ${this.jobs.length} jobs from ${configFile === this.ceremoniesPath ? 'ceremonies.json' : 'cron.json'}`,
      );
    } catch (err) {
      console.warn('[Cron] Failed to parse config:', err);
      this.jobs = [];
    }
  }

  /** Connect to ChatService for sending messages. */
  setChatService(service: ChatService): void {
    this.chatService = service;
  }

  /** Start the scheduler — checks every 60 seconds. */
  start(): void {
    this.loadConfig();

    if (this.jobs.length === 0) return;

    // Check every 60 seconds
    this.interval = setInterval(() => {
      this.tick();
    }, 60_000);

    console.log('[Cron] Scheduler started (checking every 60s)');
  }

  /** Stop the scheduler. */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    console.log('[Cron] Scheduler stopped');
  }

  /** Check all jobs and run any that are due. */
  private tick(): void {
    const now = new Date();
    const currentMinute = now.getHours() * 60 + now.getMinutes();

    // Prevent double-execution within the same minute
    if (currentMinute === this.lastCheckMinute) return;
    this.lastCheckMinute = currentMinute;

    for (const job of this.jobs) {
      if (!job.enabled) continue;
      if (!matchesCron(job.schedule, now)) continue;

      this.executeJob(job).catch((err) => {
        console.error(`[Cron] Job ${job.id} failed:`, err);
      });
    }
  }

  /** Execute a single job. */
  async executeJob(job: CronJob): Promise<void> {
    console.log(`[Cron] Executing job: ${job.id} (action: ${job.action})`);
    const startTime = new Date().toISOString();

    try {
      if (job.action === 'chat') {
        await this.executeChatAction(job);
      } else if (job.action === 'task') {
        this.executeTaskAction(job);
      }

      this.executions.push({ jobId: job.id, executedAt: startTime, result: 'success' });
      console.log(`[Cron] Job ${job.id} completed successfully`);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.executions.push({
        jobId: job.id,
        executedAt: startTime,
        result: 'error',
        error: errorMsg,
      });
      throw err;
    }
  }

  /** Send a chat message as a scheduled job. */
  private async executeChatAction(job: CronJob): Promise<void> {
    if (!this.chatService) {
      console.warn(`[Cron] ChatService not connected — cannot execute chat job ${job.id}`);
      return;
    }

    await this.chatService.send({
      sender: job.agent,
      recipient: job.channel ?? 'team',
      content: job.message ?? '',
    });
  }

  /** Create a task file as a scheduled job. */
  private executeTaskAction(job: CronJob): void {
    if (!existsSync(this.tasksDir)) {
      mkdirSync(this.tasksDir, { recursive: true });
    }

    const taskId = `cron-${job.id}-${Date.now()}`;
    const taskContent = [
      `# ${job.title ?? job.id}`,
      '',
      `**Assigned to:** ${job.agent}`,
      `**Created by:** cron (${job.id})`,
      `**Created at:** ${new Date().toISOString()}`,
      '',
      job.description ?? '',
    ].join('\n');

    writeFileSync(join(this.tasksDir, `${taskId}.md`), taskContent, 'utf-8');
    console.log(`[Cron] Created task: ${taskId}`);
  }

  // ── Public API ──────────────────────────────────────────────────

  /** List all configured jobs with their status. */
  listJobs(): Array<CronJob & { lastExecution?: CronExecution }> {
    return this.jobs.map((job) => {
      const lastExec = [...this.executions].reverse().find((e) => e.jobId === job.id);
      return { ...job, lastExecution: lastExec };
    });
  }

  /** Get a job by ID. */
  getJob(id: string): CronJob | undefined {
    return this.jobs.find((j) => j.id === id);
  }

  /** Enable or disable a job. */
  setJobEnabled(id: string, enabled: boolean): CronJob | null {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return null;

    job.enabled = enabled;
    this.persistConfig();
    return job;
  }

  /** Manually trigger a job. */
  async triggerJob(id: string): Promise<CronExecution | null> {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return null;

    try {
      await this.executeJob(job);
      return this.executions[this.executions.length - 1] ?? null;
    } catch {
      return this.executions[this.executions.length - 1] ?? null;
    }
  }

  /** Get execution history. */
  getExecutions(limit = 50): CronExecution[] {
    return this.executions.slice(-limit);
  }

  /** Add a new cron job and persist. */
  addJob(job: CronJob): CronJob {
    if (this.jobs.some((j) => j.id === job.id)) {
      throw new Error(`Job "${job.id}" already exists`);
    }
    this.jobs.push(job);
    this.persistConfig();
    return job;
  }

  /** Delete a cron job by ID. */
  deleteJob(id: string): boolean {
    const idx = this.jobs.findIndex((j) => j.id === id);
    if (idx < 0) return false;
    this.jobs.splice(idx, 1);
    this.persistConfig();
    return true;
  }

  /** Update a cron job by ID. */
  updateJob(id: string, updates: Partial<Omit<CronJob, 'id'>>): CronJob | null {
    const job = this.jobs.find((j) => j.id === id);
    if (!job) return null;
    Object.assign(job, updates);
    this.persistConfig();
    return job;
  }

  /** Persist current job config back to the active config file. */
  private persistConfig(): void {
    try {
      const config: CronConfig = { jobs: this.jobs };
      // Write to ceremonies.json if it exists, otherwise cron.json
      const targetPath = existsSync(this.ceremoniesPath) ? this.ceremoniesPath : this.configPath;
      writeFileSync(targetPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    } catch (err) {
      console.warn('[Cron] Failed to persist config:', err);
    }
  }
}
