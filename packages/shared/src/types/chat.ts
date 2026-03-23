/**
 * Chat types — represents messages in the text chat interface.
 */

/** A chat message between users and agents. */
export interface ChatMessage {
  /** Unique identifier. */
  id: string;
  /** Sender: user ID or agent ID. */
  sender: string;
  /** Recipient: a specific agent ID or "team" for team-wide messages. */
  recipient: string;
  /** Message body (supports markdown). */
  content: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** Optional thread ID for threaded replies. */
  threadId: string | null;
}
