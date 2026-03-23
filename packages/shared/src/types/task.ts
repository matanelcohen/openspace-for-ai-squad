/**
 * Task types — represents a unit of work in the task board.
 */

/** Kanban column statuses matching the PRD task board. */
export type TaskStatus = 'backlog' | 'in-progress' | 'in-review' | 'done' | 'blocked';

/** Priority levels (P0 = highest urgency). */
export type TaskPriority = 'P0' | 'P1' | 'P2' | 'P3';

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
  /** Agent ID assigned to this task, or null if unassigned. */
  assignee: string | null;
  /** Freeform labels/tags for filtering. */
  labels: string[];
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-updated timestamp. */
  updatedAt: string;
  /** Numeric index for drag-and-drop ordering within a priority level. */
  sortIndex: number;
}
