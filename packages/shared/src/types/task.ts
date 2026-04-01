/**
 * Task types — represents a unit of work in the task board.
 */

/** Kanban column statuses matching the PRD task board. */
export type TaskStatus =
  | 'pending'
  | 'in-progress'
  | 'in-review'
  | 'done'
  | 'merged'
  | 'blocked'
  | 'delegated';

/** Priority levels (P0 = highest urgency). */
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

/** Whether the assignee is an AI agent or a human team member. */
export type TaskAssigneeType = 'agent' | 'member';

/** A task tracked on the squad's task board. */
export interface Task {
  /** Unique identifier. */
  id: string;
  /** Short summary of the work. */
  title: string;
  /** Detailed description (supports markdown). */
  description: string;
  /** Current kanban status. */
  status: TaskStatus;
  /** Urgency level. */
  priority: TaskPriority;
  /** Agent or team member ID assigned to this task, or null if unassigned. */
  assignee: string | null;
  /** Whether the assignee is an AI agent or a human team member. */
  assigneeType: TaskAssigneeType;
  /** Freeform labels/tags for filtering. */
  labels: string[];
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-updated timestamp. */
  updatedAt: string;
  /** Numeric index for drag-and-drop ordering within a priority level. */
  sortIndex: number;
  /** Parent task ID when this is a delegated subtask. */
  parent?: string | null;
  /** Task IDs that must be completed before this task can start. */
  dependsOn?: string[];
  /** ISO-8601 due date, or null if no deadline. */
  dueDate?: string | null;
  /** ISO-8601 expiration timestamp. Tasks past this time are auto-expired. */
  expiresAt?: string | null;
}
