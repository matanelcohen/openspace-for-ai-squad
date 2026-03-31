/**
 * TeamStatusService — Formats active agent status for injection into system prompts.
 *
 * Tracks which agents are currently working and produces a markdown summary
 * suitable for inclusion in agent system prompts, so each agent is aware of
 * what teammates are doing. Stale entries (>30 min) are automatically excluded.
 */

// ── Types ────────────────────────────────────────────────────────

export interface AgentStatusProvider {
  getStatus(): Record<string, { activeTask: string | null; queueLength: number }>;
  getAgents(): Array<{ id: string; name: string; role: string }>;
}

export interface WorkingEvent {
  agentId: string;
  taskId: string;
  taskTitle: string;
  timestamp: number;
}

// ── Service ──────────────────────────────────────────────────────

const DEFAULT_STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export class TeamStatusService {
  private readonly provider: AgentStatusProvider;
  private readonly workingEvents = new Map<string, WorkingEvent>();
  private readonly staleThresholdMs: number;

  constructor(provider: AgentStatusProvider, staleThresholdMs = DEFAULT_STALE_THRESHOLD_MS) {
    this.provider = provider;
    this.staleThresholdMs = staleThresholdMs;
  }

  /** Record that an agent started working on a task. */
  recordWorkingEvent(agentId: string, taskId: string, taskTitle: string): void {
    this.workingEvents.set(agentId, {
      agentId,
      taskId,
      taskTitle,
      timestamp: Date.now(),
    });
  }

  /** Clear a working event (agent finished or went idle). */
  clearWorkingEvent(agentId: string): void {
    this.workingEvents.delete(agentId);
  }

  /**
   * Return a markdown-formatted summary of active teammates.
   *
   * @param excludeAgentId  Agent to omit (typically the one receiving the prompt).
   * @returns Markdown string with `## Team Status` header, or empty string if
   *          no other agents are actively working.
   */
  getFormattedStatus(excludeAgentId?: string): string {
    const status = this.provider.getStatus();
    const agents = this.provider.getAgents();
    const now = Date.now();

    const lines: string[] = [];

    for (const agent of agents) {
      if (excludeAgentId && agent.id === excludeAgentId) continue;

      const agentStatus = status[agent.id];
      if (!agentStatus?.activeTask) continue;

      // Exclude stale entries
      const event = this.workingEvents.get(agent.id);
      if (event && now - event.timestamp > this.staleThresholdMs) continue;

      const taskTitle = event?.taskTitle ?? agentStatus.activeTask;
      lines.push(`- **${agent.name}** (${agent.role}): Working on "${taskTitle}"`);
    }

    if (lines.length === 0) return '';

    return `## Team Status\n\n${lines.join('\n')}`;
  }
}
