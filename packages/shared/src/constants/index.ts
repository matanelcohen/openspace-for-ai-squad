/**
 * Shared constants — single source of truth for enum-like values
 * used by both frontend and backend.
 */

import type { ActivityEventType, AgentStatus, TaskPriority, TaskStatus } from '../types/index.js';

// ---------------------------------------------------------------------------
// Task statuses
// ---------------------------------------------------------------------------

export const TASK_STATUSES = [
  'backlog',
  'in-progress',
  'in-review',
  'done',
  'blocked',
] as const satisfies readonly TaskStatus[];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  done: 'Done',
  blocked: 'Blocked',
};

// ---------------------------------------------------------------------------
// Task priorities
// ---------------------------------------------------------------------------

export const TASK_PRIORITIES = ['P0', 'P1', 'P2', 'P3'] as const satisfies readonly TaskPriority[];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  P0: 'Critical',
  P1: 'High',
  P2: 'Medium',
  P3: 'Low',
};

// ---------------------------------------------------------------------------
// Agent statuses
// ---------------------------------------------------------------------------

export const AGENT_STATUSES = [
  'idle',
  'active',
  'spawned',
  'failed',
] as const satisfies readonly AgentStatus[];

export const AGENT_STATUS_LABELS: Record<AgentStatus, string> = {
  idle: 'Idle',
  active: 'Active',
  spawned: 'Spawned',
  failed: 'Failed',
};

// ---------------------------------------------------------------------------
// Activity event types
// ---------------------------------------------------------------------------

export const ACTIVITY_EVENT_TYPES = [
  'spawned',
  'started',
  'completed',
  'failed',
  'decision',
  'error',
] as const satisfies readonly ActivityEventType[];

export const ACTIVITY_EVENT_TYPE_LABELS: Record<ActivityEventType, string> = {
  spawned: 'Spawned',
  started: 'Started',
  completed: 'Completed',
  failed: 'Failed',
  decision: 'Decision',
  error: 'Error',
};

// ---------------------------------------------------------------------------
// Agent roles (convention for the default squad)
// ---------------------------------------------------------------------------

export const AGENT_ROLES = ['Lead', 'Backend', 'Frontend', 'QA'] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

// ---------------------------------------------------------------------------
// Chat recipient sentinel
// ---------------------------------------------------------------------------

/** Special recipient value meaning "send to the whole team". */
export const CHAT_TEAM_RECIPIENT = 'team' as const;
