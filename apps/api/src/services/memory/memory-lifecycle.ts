/**
 * MemoryLifecycleService — automated decay, expiration, and consolidation.
 *
 * Runs on a configurable interval (default: daily) to:
 * 1. Apply strength decay to all agent memories
 * 2. Expire memories past their TTL
 * 3. Archive memories below the strength threshold
 *
 * Can also be triggered manually via the consolidation API endpoint.
 */

import { hasMemorySchema, initializeMemorySchema, MemoryStoreService } from '@matanelcohen/openspace-memory-store';
import type { MemoryConsolidationResult } from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';

// ── Types ────────────────────────────────────────────────────────

export interface LifecycleConfig {
  /** Interval in milliseconds between lifecycle runs. Default: 24h */
  intervalMs?: number;
  /** Strength threshold below which memories are archived. Default: 0.1 */
  archiveThreshold?: number;
  /** Whether to run immediately on start. Default: true */
  runOnStart?: boolean;
}

export interface LifecycleRunResult {
  ranAt: string;
  agents: Record<string, MemoryConsolidationResult>;
  totalArchived: number;
  totalRemaining: number;
}

const DEFAULT_CONFIG: Required<LifecycleConfig> = {
  intervalMs: 24 * 60 * 60 * 1000, // 24 hours
  archiveThreshold: 0.1,
  runOnStart: true,
};

// ── Service ──────────────────────────────────────────────────────

export class MemoryLifecycleService {
  private readonly db: Database.Database;
  private readonly config: Required<LifecycleConfig>;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastRun: LifecycleRunResult | null = null;

  constructor(db: Database.Database, config?: LifecycleConfig) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Start the lifecycle timer. */
  start(): void {
    // Ensure schema exists
    if (!hasMemorySchema(this.db)) {
      initializeMemorySchema(this.db);
    }

    if (this.config.runOnStart) {
      // Run after a short delay to let the app finish booting
      setTimeout(() => {
        this.run().catch((err) => {
          console.warn('[MemoryLifecycle] Initial run failed:', err instanceof Error ? err.message : err);
        });
      }, 5000);
    }

    this.timer = setInterval(() => {
      this.run().catch((err) => {
        console.warn('[MemoryLifecycle] Scheduled run failed:', err instanceof Error ? err.message : err);
      });
    }, this.config.intervalMs);

    console.log(
      `[MemoryLifecycle] Started (interval: ${Math.round(this.config.intervalMs / 3600000)}h, threshold: ${this.config.archiveThreshold})`,
    );
  }

  /** Stop the lifecycle timer. */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Run a lifecycle pass: decay + expire + archive for all agents. */
  async run(agentId?: string): Promise<LifecycleRunResult> {
    const store = new MemoryStoreService(this.db, {});
    const results: Record<string, MemoryConsolidationResult> = {};

    if (agentId) {
      results[agentId] = store.consolidate(agentId, this.config.archiveThreshold);
    } else {
      // Get all agents with memories
      const agents = this.db
        .prepare<[], { agent_id: string }>('SELECT DISTINCT agent_id FROM memories WHERE enabled = 1')
        .all();

      for (const row of agents) {
        results[row.agent_id] = store.consolidate(row.agent_id, this.config.archiveThreshold);
      }
    }

    let totalArchived = 0;
    let totalRemaining = 0;
    for (const result of Object.values(results)) {
      totalArchived += result.archived;
      totalRemaining += result.remaining;
    }

    this.lastRun = {
      ranAt: new Date().toISOString(),
      agents: results,
      totalArchived,
      totalRemaining,
    };

    if (totalArchived > 0) {
      console.log(
        `[MemoryLifecycle] Archived ${totalArchived} weak memories, ${totalRemaining} remaining`,
      );
    }

    return this.lastRun;
  }

  /** Get the result of the last lifecycle run. */
  getLastRun(): LifecycleRunResult | null {
    return this.lastRun;
  }
}
