/**
 * Voice types — real-time group voice chat interfaces.
 *
 * Models the continuous multi-party voice conversation described
 * in PRD §3.4: always-on mic, multi-agent routing, per-agent
 * personality voices, shared conversation context.
 */

/** Lifecycle states of a voice session. */
export type VoiceSessionStatus = 'active' | 'paused' | 'ended';

/** Who is speaking in a voice turn. */
export type VoiceParticipantRole = 'user' | 'agent';

/** Per-agent voice configuration — each agent has a unique voice. */
export interface VoiceProfile {
  /** Agent ID this profile belongs to. */
  agentId: string;
  /** Display name used in voice transcripts. */
  displayName: string;
  /** TTS voice identifier (e.g., OpenAI voice ID). */
  voiceId: string;
  /** Short personality description for prompt context. */
  personality: string;
}

/** A single spoken turn in a voice session. */
export interface VoiceMessage {
  /** Unique identifier. */
  id: string;
  /** ID of the parent voice session. */
  sessionId: string;
  /** Who spoke — user or agent. */
  role: VoiceParticipantRole;
  /** If role is "agent", the agent's ID. Null for user turns. */
  agentId: string | null;
  /** Transcribed or generated text content. */
  content: string;
  /** ISO-8601 timestamp of this turn. */
  timestamp: string;
  /** Duration in milliseconds of the audio clip, if available. */
  durationMs: number | null;
}

/** A voice conversation session with the squad. */
export interface VoiceSession {
  /** Unique identifier. */
  id: string;
  /** Human-readable session title (e.g., "Morning standup"). */
  title: string;
  /** Current session lifecycle status. */
  status: VoiceSessionStatus;
  /** IDs of agents participating in this session. */
  participantAgentIds: string[];
  /** ISO-8601 timestamp when the session started. */
  startedAt: string;
  /** ISO-8601 timestamp when the session ended, if it has. */
  endedAt: string | null;
  /** Ordered list of voice turns in the session. */
  messages: VoiceMessage[];
}
