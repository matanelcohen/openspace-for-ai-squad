/**
 * YOLO Mode Service — autonomous task triage and assignment.
 *
 * When enabled, the lead agent periodically scans pending tasks,
 * decides which agent should handle each one, and enqueues them
 * for execution — no human intervention required.
 */

import type { Task } from '@openspace/shared';

import type { AgentWorkerService } from '../agent-worker/index.js';
import type { AIProvider } from '../ai/copilot-provider.js';
import type { SquadParser } from '../squad-parser/index.js';
import { getTask, updateTask } from '../squad-writer/task-writer.js';
import type { WebSocketManager, WsEnvelope } from '../websocket/index.js';

// ── Types ────────────────────────────────────────────────────────

export interface ScanDecision {
  taskId: string;
  action: 'assign' | 'skip';
  agentId?: string;
  reason: string;
}

export interface ScanResult {
  decisions: ScanDecision[];
  assigned: number;
  skipped: number;
  timestamp: string;
}

export interface YoloStatus {
  enabled: boolean;
  lastScanAt: string | null;
  results: { assigned: number; skipped: number };
  nextScanIn: number;
}

interface YoloConfig {
  aiProvider: AIProvider | null;
  agentWorker: AgentWorkerService | null;
  squadParser: SquadParser;
  tasksDir: string;
  wsManager: WebSocketManager | null;
  scanIntervalMs?: number;
  maxTasksPerScan?: number;
}

// ── Service ──────────────────────────────────────────────────────

export class YoloService {
  private enabled = false;
  private interval: NodeJS.Timeout | null = null;
  private lastScanAt: string | null = null;
  private scanResults = { assigned: 0, skipped: 0 };
  private scanIntervalMs: number;
  private maxTasksPerScan: number;
  private lastIntervalStart = 0;

  private config: YoloConfig;

  constructor(config: YoloConfig) {
    this.config = config;
    this.scanIntervalMs = config.scanIntervalMs ?? 60_000;
    this.maxTasksPerScan = config.maxTasksPerScan ?? 5;
  }

  // ── Public API ───────────────────────────────────────────────

  async start(opts?: { scanIntervalMs?: number; maxTasksPerScan?: number }): Promise<void> {
    if (this.enabled) return;

    if (!this.config.aiProvider) {
      throw new Error('AI provider not available — cannot start YOLO mode');
    }
    if (!this.config.agentWorker) {
      throw new Error('Agent worker not available — cannot start YOLO mode');
    }

    if (opts?.scanIntervalMs) this.scanIntervalMs = opts.scanIntervalMs;
    if (opts?.maxTasksPerScan) this.maxTasksPerScan = opts.maxTasksPerScan;

    this.enabled = true;
    this.lastIntervalStart = Date.now();

    // Run the first scan immediately
    this.runScanSafe();

    this.interval = setInterval(() => {
      this.lastIntervalStart = Date.now();
      this.runScanSafe();
    }, this.scanIntervalMs);

    console.log(`[YOLO] Started — scanning every ${this.scanIntervalMs / 1000}s`);
  }

  stop(): void {
    if (!this.enabled) return;

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.enabled = false;
    console.log('[YOLO] Stopped');
  }

  getStatus(): YoloStatus {
    const elapsed = this.lastIntervalStart ? Date.now() - this.lastIntervalStart : 0;
    const nextScanIn = this.enabled ? Math.max(0, this.scanIntervalMs - elapsed) : 0;

    return {
      enabled: this.enabled,
      lastScanAt: this.lastScanAt,
      results: { ...this.scanResults },
      nextScanIn,
    };
  }

  async scan(): Promise<ScanResult> {
    return this.runScan();
  }

  // ── Internal ─────────────────────────────────────────────────

  private runScanSafe(): void {
    this.runScan().catch((err) => {
      console.error('[YOLO] Scan failed:', err);
    });
  }

  private async runScan(): Promise<ScanResult> {
    const { aiProvider, agentWorker, squadParser, tasksDir } = this.config;

    if (!aiProvider || !agentWorker) {
      return { decisions: [], assigned: 0, skipped: 0, timestamp: new Date().toISOString() };
    }

    // 1. Get pending tasks
    const allTasks = await squadParser.getTasks();
    const pendingTasks = allTasks.filter((t) => t.status === 'pending');

    if (pendingTasks.length === 0) {
      const result: ScanResult = {
        decisions: [],
        assigned: 0,
        skipped: 0,
        timestamp: new Date().toISOString(),
      };
      this.lastScanAt = result.timestamp;
      return result;
    }

    // 2. Get agent status
    const agents = await squadParser.getAgents();
    const workerStatus = agentWorker.getStatus();

    // 3. Find the lead agent
    const leadAgent = agents.find(
      (a) => /lead|architect/i.test(a.role),
    );

    // 4. Build agent availability lines
    const agentLines = agents.map((a) => {
      const status = workerStatus[a.id];
      const state = status?.activeTask ? `working on "${status.activeTask}"` : 'idle';
      return `- ${a.name} (${a.role}) — ${state}`;
    });

    // 5. Build pending task lines (capped to maxTasksPerScan)
    const tasksToConsider = pendingTasks.slice(0, this.maxTasksPerScan);
    const taskLines = tasksToConsider.map((t, i) => {
      const desc = (t.description ?? '').slice(0, 200);
      return `${i + 1}. [${t.priority}] "${t.title}" (id: ${t.id}) — ${desc || 'No description'}`;
    });

    // 6. Build prompt
    const systemPrompt = `You are the lead architect. Review pending tasks and assign to available agents.

Available agents:
${agentLines.join('\n')}

Pending tasks:
${taskLines.join('\n')}

Respond with JSON only:
{
  "decisions": [
    { "taskId": "task-xxx", "action": "assign", "agentId": "agent-slug", "reason": "..." },
    { "taskId": "task-yyy", "action": "skip", "reason": "too vague" }
  ]
}

Rules:
- Max ${this.maxTasksPerScan} assignments per scan
- Assign based on agent role match
- Skip tasks that are vague or need clarification
- Don't assign to agents already working on something
- agentId must be the agent's lowercase id/slug (e.g. "fry", "bender")
- Every listed task must have a decision`;

    // 7. Call LLM
    let decisions: ScanDecision[] = [];
    try {
      const result = await aiProvider.chatCompletion({
        messages: [
          { role: 'user', content: 'Triage the pending tasks and assign them to available agents.' },
        ],
        systemPrompt,
        taskTitle: 'YOLO Mode — auto-triage',
        agentId: leadAgent?.id ?? 'lead',
      });

      // Parse JSON from response (handle markdown code blocks)
      const raw = result.content.replace(/```json?\s*/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(raw) as { decisions: ScanDecision[] };
      decisions = parsed.decisions ?? [];
    } catch (err) {
      console.error('[YOLO] LLM parse error:', err);
      return {
        decisions: [],
        assigned: 0,
        skipped: 0,
        timestamp: new Date().toISOString(),
      };
    }

    // 8. Execute decisions
    let assigned = 0;
    let skipped = 0;

    for (const decision of decisions) {
      try {
        if (decision.action === 'assign' && decision.agentId) {
          await updateTask(tasksDir, decision.taskId, {
            assignee: decision.agentId,
            status: 'in-progress' as Task['status'],
            description: undefined, // preserve existing
          });

          // Re-read the updated task to enqueue it
          const updatedTask = await getTask(tasksDir, decision.taskId);

          // Append YOLO marker to description
          const marker = `\n\n---\n🤖 Auto-assigned by YOLO to ${decision.agentId}: ${decision.reason}`;
          await updateTask(tasksDir, decision.taskId, {
            description: updatedTask.description + marker,
          });

          // Re-read after marker update for enqueue
          const taskForQueue = await getTask(tasksDir, decision.taskId);
          agentWorker.enqueue(taskForQueue);
          assigned++;
        } else if (decision.action === 'skip') {
          // Add a skip note to the task
          const task = await getTask(tasksDir, decision.taskId);
          const note = `\n\n---\n⏭️ YOLO skipped: ${decision.reason}`;
          await updateTask(tasksDir, decision.taskId, {
            description: task.description + note,
          });
          skipped++;
        }
      } catch (err) {
        console.error(`[YOLO] Failed to process decision for ${decision.taskId}:`, err);
      }
    }

    // 9. Update results
    const timestamp = new Date().toISOString();
    this.lastScanAt = timestamp;
    this.scanResults = { assigned, skipped };

    // 10. Broadcast via WebSocket
    if (this.config.wsManager) {
      this.config.wsManager.broadcast({
        type: 'activity:new',
        payload: {
          yoloEvent: 'yolo:decision',
          decisions,
          assigned,
          skipped,
        },
        timestamp,
      } as WsEnvelope);
    }

    console.log(`[YOLO] Scan complete — assigned: ${assigned}, skipped: ${skipped}`);

    const scanResult: ScanResult = { decisions, assigned, skipped, timestamp };
    return scanResult;
  }
}
