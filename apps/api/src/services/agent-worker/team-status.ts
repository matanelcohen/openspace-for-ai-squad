/**
 * Team Status Service — builds a formatted markdown block describing
 * what other squad members are currently working on.
 *
 * Injected into each agent's system prompt so they have situational
 * awareness of the team. The requesting agent is excluded from the list,
 * and agents idle for more than 30 minutes are filtered out.
 */

// ── Types ────────────────────────────────────────────────────────

export interface AgentStatus {
  activeTask: string | null;
  queueLength: number;
  /** Human-readable title of the active task. */
  taskTitle?: string;
  /** Git branch the agent is working on. */
  branch?: string;
  /** Timestamp of the agent's last activity. Used for staleness filtering. */
  lastActiveAt?: Date;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  personality: string;
}

// ── Service ──────────────────────────────────────────────────────

export class TeamStatusService {
  /** Agents idle longer than this are considered stale and omitted. */
  static readonly STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

  /** Task titles longer than this are truncated with an ellipsis. */
  static readonly MAX_TITLE_LENGTH = 80;

  /**
   * Build a markdown block summarizing the team's current status.
   *
   * @param statuses   Map of agentId → current status (from AgentWorkerService.getStatus())
   * @param agents     Full list of agent profiles
   * @param requestingAgentId  The agent requesting the block (excluded from output)
   * @param now        Current time (injectable for testing)
   * @returns Formatted markdown string, or `null` if there are no teammates to show
   */
  buildTeamStatusBlock(
    statuses: Record<string, AgentStatus>,
    agents: AgentProfile[],
    requestingAgentId: string,
    now: Date = new Date(),
  ): string | null {
    const entries: string[] = [];

    for (const agent of agents) {
      if (agent.id === requestingAgentId) continue;

      const status = statuses[agent.id];
      if (!status) continue;

      if (this.isStale(status, now)) continue;

      entries.push(this.formatAgentEntry(agent, status));
    }

    if (entries.length === 0) return null;

    return (
      `## Team Status\n\n` +
      `Your teammates are currently working on the following:\n\n` +
      entries.join('\n') +
      `\n\nCoordinate with your team to avoid conflicts and duplicate work.`
    );
  }

  /**
   * Format a single agent's status as a markdown list item.
   */
  formatAgentEntry(agent: AgentProfile, status: AgentStatus): string {
    const title = status.taskTitle ? this.truncateTitle(status.taskTitle) : null;

    if (status.activeTask && title) {
      const branchInfo = status.branch ? ` (branch: \`${status.branch}\`)` : '';
      const queueInfo = status.queueLength > 0 ? ` [+${status.queueLength} queued]` : '';
      return `- **${agent.name}** (${agent.role}): Working on "${title}"${branchInfo}${queueInfo}`;
    }

    if (status.activeTask) {
      return `- **${agent.name}** (${agent.role}): Busy (task in progress)`;
    }

    if (status.queueLength > 0) {
      return `- **${agent.name}** (${agent.role}): Idle — ${status.queueLength} task(s) queued`;
    }

    return `- **${agent.name}** (${agent.role}): Idle`;
  }

  /**
   * Determine whether an agent's status is stale.
   * An agent is stale if it has no active task and its last activity
   * was more than STALE_THRESHOLD_MS ago.
   */
  isStale(status: AgentStatus, now: Date): boolean {
    // Actively working agents are never stale
    if (status.activeTask) return false;

    // Agents with queued work are never stale
    if (status.queueLength > 0) return false;

    // If no lastActiveAt is provided, assume not stale (recently started)
    if (!status.lastActiveAt) return false;

    return now.getTime() - status.lastActiveAt.getTime() > TeamStatusService.STALE_THRESHOLD_MS;
  }

  /**
   * Truncate a title to MAX_TITLE_LENGTH, appending "…" if truncated.
   */
  private truncateTitle(title: string): string {
    if (title.length <= TeamStatusService.MAX_TITLE_LENGTH) return title;
    return title.substring(0, TeamStatusService.MAX_TITLE_LENGTH - 1) + '…';
  }
}
