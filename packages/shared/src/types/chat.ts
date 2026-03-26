/**
 * Chat types — represents messages in the text chat interface.
 */

/** A chat message between users and agents. */
export interface ChatMessage {
  /** Unique identifier. */
  id: string;
  /** Sender: user ID or agent ID. */
  sender: string;
  /** Recipient: a specific agent ID, "team", or "channel:<id>" for group channels. */
  recipient: string;
  /** Message body (supports markdown). */
  content: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Optional thread ID for threaded replies. */
  threadId: string | null;
}

/**
 * A group chat channel containing a subset of the team.
 *
 * Alias: `Channel` (preferred for non-chat contexts).
 */
export interface ChatChannel {
  /** Unique identifier. */
  id: string;
  /** Human-readable channel name (e.g., "Frontend", "Backend"). */
  name: string;
  /** Optional channel description. */
  description: string;
  /** IDs of the agents that belong to this channel. */
  memberAgentIds: string[];
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-updated timestamp. */
  updatedAt: string;
}

/** Alias: `Channel` (preferred for non-chat contexts). */
export type Channel = ChatChannel;
