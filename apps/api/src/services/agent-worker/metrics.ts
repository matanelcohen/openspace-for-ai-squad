export interface QueueMetrics {
  agents: Record<string, AgentMetrics>;
  system: SystemMetrics;
}

export interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  avgDurationMs: number;
  lastCompletedAt: string | null;
  queueDepth: number;
  activeTask: string | null;
}

export interface SystemMetrics {
  totalCompleted: number;
  totalFailed: number;
  totalQueued: number;
  uptime: number; // seconds
  startedAt: string;
}

export class MetricsCollector {
  private startedAt = new Date().toISOString();
  private agentStats = new Map<string, {
    completed: number;
    failed: number;
    totalDurationMs: number;
    lastCompletedAt: string | null;
  }>();

  recordCompletion(agentId: string, durationMs: number): void {
    const stats = this.agentStats.get(agentId) ?? { completed: 0, failed: 0, totalDurationMs: 0, lastCompletedAt: null };
    stats.completed++;
    stats.totalDurationMs += durationMs;
    stats.lastCompletedAt = new Date().toISOString();
    this.agentStats.set(agentId, stats);
  }

  recordFailure(agentId: string): void {
    const stats = this.agentStats.get(agentId) ?? { completed: 0, failed: 0, totalDurationMs: 0, lastCompletedAt: null };
    stats.failed++;
    this.agentStats.set(agentId, stats);
  }

  getMetrics(getStatus: () => Record<string, { activeTask: unknown; queueLength: number }>): QueueMetrics {
    const status = getStatus();
    const agents: Record<string, AgentMetrics> = {};
    let totalCompleted = 0, totalFailed = 0, totalQueued = 0;

    for (const [agentId, info] of Object.entries(status)) {
      const stats = this.agentStats.get(agentId);
      const completed = stats?.completed ?? 0;
      const failed = stats?.failed ?? 0;
      agents[agentId] = {
        tasksCompleted: completed,
        tasksFailed: failed,
        avgDurationMs: completed > 0 ? Math.round((stats?.totalDurationMs ?? 0) / completed) : 0,
        lastCompletedAt: stats?.lastCompletedAt ?? null,
        queueDepth: info.queueLength,
        activeTask: info.activeTask ? String((info.activeTask as any)?.id ?? info.activeTask) : null,
      };
      totalCompleted += completed;
      totalFailed += failed;
      totalQueued += info.queueLength;
    }

    return {
      agents,
      system: {
        totalCompleted,
        totalFailed,
        totalQueued,
        uptime: Math.round((Date.now() - new Date(this.startedAt).getTime()) / 1000),
        startedAt: this.startedAt,
      },
    };
  }
}
