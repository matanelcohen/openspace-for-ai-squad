/**
 * Correlation tracker — groups messages by correlationId and tracks
 * completion of split work across multiple agents.
 *
 * The tracker maintains a parent→children relationship so delegated
 * sub-tasks can be merged back to the originating task.
 */

import type {
  A2AArtifact,
  A2AMessage,
  A2AProgressStatus,
} from '../types/a2a.js';

// ── Types ────────────────────────────────────────────────────────

/** Aggregated status of a correlation group. */
export interface CorrelationStatus {
  correlationId: string;
  /** The original delegation request message ID (if any). */
  originMessageId: string | null;
  /** Total sub-tasks in this group. */
  totalSubTasks: number;
  /** Number of completed sub-tasks. */
  completedSubTasks: number;
  /** Number of failed sub-tasks. */
  failedSubTasks: number;
  /** Aggregated progress percentage (average of sub-task progress). */
  progressPercent: number;
  /** Overall status derived from sub-task statuses. */
  overallStatus: A2AProgressStatus;
  /** All artifacts collected from sub-tasks. */
  artifacts: A2AArtifact[];
  /** ISO-8601 timestamp of last update. */
  updatedAt: string;
}

/** Tracks a single sub-task within a correlation group. */
export interface SubTaskEntry {
  /** The delegation request message ID for this sub-task. */
  messageId: string;
  /** Agent handling the sub-task. */
  assigneeId: string;
  /** Task ID being delegated. */
  taskId: string;
  /** Current progress status. */
  status: A2AProgressStatus;
  /** Numeric progress (0–100). */
  progressPercent: number;
  /** Artifacts produced. */
  artifacts: A2AArtifact[];
  /** ISO-8601 timestamp of last update. */
  updatedAt: string;
}

// ── Tracker ──────────────────────────────────────────────────────

export class CorrelationTracker {
  /** correlationId → origin message ID */
  private readonly origins = new Map<string, string>();

  /** correlationId → sub-task entries keyed by messageId */
  private readonly subTasks = new Map<string, Map<string, SubTaskEntry>>();

  /** Change listener callbacks */
  private readonly listeners: Array<(status: CorrelationStatus) => void> = [];

  // ── Registration ─────────────────────────────────────────────

  /** Register a correlation group with its origin message. */
  registerCorrelation(correlationId: string, originMessageId: string): void {
    this.origins.set(correlationId, originMessageId);
    if (!this.subTasks.has(correlationId)) {
      this.subTasks.set(correlationId, new Map());
    }
  }

  /** Add a sub-task entry to a correlation group. */
  addSubTask(correlationId: string, entry: SubTaskEntry): void {
    let group = this.subTasks.get(correlationId);
    if (!group) {
      group = new Map();
      this.subTasks.set(correlationId, group);
    }
    group.set(entry.messageId, entry);
    this.notifyListeners(correlationId);
  }

  // ── Status Updates ───────────────────────────────────────────

  /**
   * Update a sub-task's status. Returns the updated correlation status,
   * or null if the sub-task doesn't exist.
   */
  updateSubTask(
    correlationId: string,
    messageId: string,
    update: Partial<Pick<SubTaskEntry, 'status' | 'progressPercent' | 'artifacts'>>,
  ): CorrelationStatus | null {
    const group = this.subTasks.get(correlationId);
    if (!group) return null;

    const entry = group.get(messageId);
    if (!entry) return null;

    if (update.status !== undefined) entry.status = update.status;
    if (update.progressPercent !== undefined) entry.progressPercent = update.progressPercent;
    if (update.artifacts) entry.artifacts = [...entry.artifacts, ...update.artifacts];
    entry.updatedAt = new Date().toISOString();

    this.notifyListeners(correlationId);
    return this.getStatus(correlationId)!;
  }

  // ── Queries ──────────────────────────────────────────────────

  /** Get the aggregated status of a correlation group. */
  getStatus(correlationId: string): CorrelationStatus | null {
    const group = this.subTasks.get(correlationId);
    if (!group) return null;

    const entries = Array.from(group.values());
    const total = entries.length;
    const completed = entries.filter((e) => e.status === 'completed').length;
    const failed = entries.filter((e) => e.status === 'failed').length;

    const progressSum = entries.reduce((sum, e) => sum + e.progressPercent, 0);
    const avgProgress = total > 0 ? Math.round(progressSum / total) : 0;

    const allArtifacts = entries.flatMap((e) => e.artifacts);

    const latestUpdate = entries.reduce(
      (latest, e) => (e.updatedAt > latest ? e.updatedAt : latest),
      '',
    );

    return {
      correlationId,
      originMessageId: this.origins.get(correlationId) ?? null,
      totalSubTasks: total,
      completedSubTasks: completed,
      failedSubTasks: failed,
      progressPercent: avgProgress,
      overallStatus: deriveOverallStatus(entries),
      artifacts: allArtifacts,
      updatedAt: latestUpdate || new Date().toISOString(),
    };
  }

  /** Get sub-task entries for a correlation group. */
  getSubTasks(correlationId: string): SubTaskEntry[] {
    const group = this.subTasks.get(correlationId);
    if (!group) return [];
    return Array.from(group.values());
  }

  /** Check if all sub-tasks in a correlation group are terminal. */
  isComplete(correlationId: string): boolean {
    const group = this.subTasks.get(correlationId);
    if (!group || group.size === 0) return false;

    for (const entry of group.values()) {
      if (entry.status !== 'completed' && entry.status !== 'failed') {
        return false;
      }
    }
    return true;
  }

  /** Collect all artifacts from completed sub-tasks in a correlation group. */
  collectArtifacts(correlationId: string): A2AArtifact[] {
    const group = this.subTasks.get(correlationId);
    if (!group) return [];

    return Array.from(group.values())
      .filter((e) => e.status === 'completed')
      .flatMap((e) => e.artifacts);
  }

  // ── Listeners ────────────────────────────────────────────────

  /** Register a listener that fires whenever a correlation group is updated. */
  onChange(listener: (status: CorrelationStatus) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const idx = this.listeners.indexOf(listener);
      if (idx !== -1) this.listeners.splice(idx, 1);
    };
  }

  /** Remove a correlation group. */
  remove(correlationId: string): void {
    this.origins.delete(correlationId);
    this.subTasks.delete(correlationId);
  }

  private notifyListeners(correlationId: string): void {
    const status = this.getStatus(correlationId);
    if (!status) return;
    for (const listener of this.listeners) {
      try {
        listener(status);
      } catch {
        // Listener errors are swallowed — never break the tracker.
      }
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Derive the overall status from a set of sub-task entries.
 * - All completed → completed
 * - Any failed and all terminal → failed
 * - Any blocked → blocked
 * - Any in_progress → in_progress
 * - Otherwise → queued
 */
function deriveOverallStatus(entries: SubTaskEntry[]): A2AProgressStatus {
  if (entries.length === 0) return 'queued';

  const statuses = new Set(entries.map((e) => e.status));

  if (statuses.size === 1 && statuses.has('completed')) return 'completed';

  const allTerminal = entries.every((e) => e.status === 'completed' || e.status === 'failed');
  if (allTerminal && statuses.has('failed')) return 'failed';

  if (statuses.has('blocked')) return 'blocked';
  if (statuses.has('needs_input')) return 'needs_input';
  if (statuses.has('in_progress')) return 'in_progress';

  return 'queued';
}

/** Utility: check whether a delegation_request message has sub-tasks from response messages. */
export function findSubTaskMessages(
  messages: A2AMessage[],
  correlationId: string,
): A2AMessage[] {
  return messages.filter(
    (m) => m.correlationId === correlationId && m.type === 'delegation_request',
  );
}
