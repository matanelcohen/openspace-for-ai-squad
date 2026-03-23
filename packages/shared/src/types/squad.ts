/**
 * Squad types — top-level squad configuration and overview.
 */

import type { Agent } from './agent.js';
import type { Decision } from './decision.js';
import type { Task, TaskStatus } from './task.js';

/** Configuration for the squad, sourced from the .squad/ directory. */
export interface SquadConfig {
  /** Unique squad identifier. */
  id: string;
  /** Human-readable squad name. */
  name: string;
  /** Short description of the squad's purpose. */
  description: string;
  /** Absolute path to the .squad/ directory. */
  squadDir: string;
  /** Agent definitions. */
  agents: Agent[];
}

/** Summary counts used on the dashboard. */
export interface TaskCounts {
  /** Count of tasks keyed by status. */
  byStatus: Record<TaskStatus, number>;
  /** Total number of tasks. */
  total: number;
}

/** High-level squad overview for the dashboard. */
export interface SquadOverview {
  /** Squad configuration. */
  config: SquadConfig;
  /** All agents with their current status. */
  agents: Agent[];
  /** Recent tasks (most recently updated). */
  recentTasks: Task[];
  /** Summary task counts for quick metrics. */
  taskCounts: TaskCounts;
  /** Recent decisions (newest first). */
  recentDecisions: Decision[];
}
