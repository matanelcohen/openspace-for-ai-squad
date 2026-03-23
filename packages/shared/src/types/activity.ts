/**
 * Activity types — represents events in the real-time activity feed.
 */

/** Categories of agent activity events. */
export type ActivityEventType =
  | 'spawned'
  | 'started'
  | 'completed'
  | 'failed'
  | 'decision'
  | 'error';

/** An event in the live agent activity feed. */
export interface ActivityEvent {
  /** Unique identifier. */
  id: string;
  /** The kind of event. */
  type: ActivityEventType;
  /** ID of the agent that triggered this event. */
  agentId: string;
  /** Human-readable description of what happened. */
  description: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Optional ID of a related task, decision, or other entity. */
  relatedEntityId: string | null;
}
