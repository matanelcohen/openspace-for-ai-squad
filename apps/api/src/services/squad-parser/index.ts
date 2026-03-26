/**
 * SquadParser — Composes all .squad/ parsers into a single service.
 *
 * Provides high-level methods for reading squad data:
 *   getAgents()       → all agents from team.md
 *   getAgent(id)      → single agent detail (charter + history)
 *   getDecisions()    → all decisions from decisions.md
 *   getSquadOverview() → composite dashboard summary
 *   getConfig()       → squad configuration
 */

import { join, resolve } from 'node:path';

import type {
  Agent,
  AgentDetail,
  ChatChannel,
  Decision,
  SquadConfig,
  SquadOverview,
  Task,
  TaskStatus,
} from '@openspace/shared';

import { parseAgentCharter } from './agent-parser.js';
import { parseAllChannels } from './channel-parser.js';
import { parseConfigFile, type RawSquadConfig } from './config-parser.js';
import { parseDecisionsFile } from './decision-parser.js';
import { parseAllTasks } from './task-parser.js';
import { parseTeamFile } from './team-parser.js';

/** Default squad directory — resolved from CWD unless overridden by env. */
function resolveSquadDir(): string {
  return process.env.SQUAD_DIR ?? resolve(process.cwd(), '.squad');
}

export class SquadParser {
  private readonly squadDir: string;

  constructor(squadDir?: string) {
    this.squadDir = squadDir ?? resolveSquadDir();
  }

  /** Get the configured .squad/ directory path. */
  getSquadDir(): string {
    return this.squadDir;
  }

  /** Parse team.md and return all agents. */
  async getAgents(): Promise<Agent[]> {
    return parseTeamFile(this.squadDir);
  }

  /** Parse a single agent's full detail (charter + history). */
  async getAgent(id: string): Promise<AgentDetail | null> {
    const agents = await this.getAgents();
    const agent = agents.find((a) => a.id === id);
    if (!agent) return null;

    return parseAgentCharter(this.squadDir, agent);
  }

  /** Parse decisions.md and return all decisions. */
  async getDecisions(): Promise<Decision[]> {
    return parseDecisionsFile(this.squadDir);
  }

  /** Get the tasks directory path. */
  getTasksDir(): string {
    return join(this.squadDir, 'tasks');
  }

  /** Get the channels directory path. */
  getChannelsDir(): string {
    return join(this.squadDir, 'channels');
  }

  /** Parse all channels from .squad/channels/. */
  async getChannels(): Promise<ChatChannel[]> {
    const { channels } = await parseAllChannels(this.getChannelsDir());
    return channels.map((c) => c.channel);
  }

  /** Parse all tasks from .squad/tasks/. */
  async getTasks(): Promise<Task[]> {
    const { tasks } = await parseAllTasks(this.getTasksDir());
    return tasks.map((t) => t.task);
  }

  /** Parse config.json and compose into SquadConfig. */
  async getConfig(): Promise<SquadConfig> {
    const [rawConfig, agents] = await Promise.all([
      parseConfigFile(this.squadDir),
      this.getAgents(),
    ]);

    return composeSquadConfig(rawConfig, agents, this.squadDir);
  }

  /** Build a composite squad overview for the dashboard. */
  async getSquadOverview(): Promise<SquadOverview> {
    const [config, agents, decisions, tasks] = await Promise.all([
      this.getConfig(),
      this.getAgents(),
      this.getDecisions(),
      this.getTasks(),
    ]);

    const byStatus: Record<TaskStatus, number> = {
      'pending-approval': 0,
      backlog: 0,
      'in-progress': 0,
      'in-review': 0,
      done: 0,
      blocked: 0,
    };
    for (const task of tasks) {
      byStatus[task.status]++;
    }

    return {
      config,
      agents,
      recentTasks: tasks.slice(0, 10),
      taskCounts: {
        byStatus,
        total: tasks.length,
      },
      recentDecisions: decisions.slice(0, 10),
    };
  }
}

/** Compose a raw config.json + agents into the full SquadConfig type. */
function composeSquadConfig(raw: RawSquadConfig, agents: Agent[], squadDir: string): SquadConfig {
  return {
    id: 'default',
    name: 'Squad',
    description: '',
    squadDir,
    agents,
  };
}

// Re-export individual parsers for direct use
export {
  parseAgentCharter,
  parseAgentHistory,
  parseCharterContent,
  parseHistoryContent,
} from './agent-parser.js';
export { parseAllChannels, parseChannelFile } from './channel-parser.js';
export { parseConfigContent, parseConfigFile, type RawSquadConfig } from './config-parser.js';
export { parseDecisionsContent, parseDecisionsFile } from './decision-parser.js';
export { parseAllTasks, parseTaskFile } from './task-parser.js';
export { parseTeamContent, parseTeamFile } from './team-parser.js';
