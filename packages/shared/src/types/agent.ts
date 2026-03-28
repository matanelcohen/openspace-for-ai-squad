/**
 * Agent types — represents an AI agent in the squad.
 */

import type { AgentCapability } from '../config/define.js';
import type { VoiceProfile } from './voice.js';

/** Possible runtime states of an agent. */
export type AgentStatus = 'idle' | 'active' | 'spawned' | 'failed';

/** An AI agent in the squad. */
export interface Agent {
  /** Unique identifier (e.g., "leela", "bender"). */
  id: string;
  /** Human-readable display name. */
  name: string;
  /** Role within the squad (e.g., "Lead", "Backend", "Frontend"). */
  role: string;
  /** Current runtime status. */
  status: AgentStatus;
  /** ID of the task the agent is currently working on, if any. */
  currentTask: string | null;
  /** Expertise tags describing the agent's capabilities. */
  expertise: string[];
  /** Structured capabilities with proficiency levels (from squad.config.ts). */
  capabilities?: AgentCapability[];
  /** Voice configuration for the real-time voice chat. */
  voiceProfile: VoiceProfile;
}

/** Parsed agent identity from the charter's Identity section. */
export interface AgentIdentity {
  /** Agent's domain expertise description. */
  expertise: string;
  /** Agent's working style description. */
  style: string;
}

/** Parsed boundaries from the charter's Boundaries section. */
export interface AgentBoundaries {
  /** What the agent handles. */
  handles: string;
  /** What the agent does not handle. */
  doesNotHandle: string;
  /** What the agent does when unsure. */
  whenUnsure: string;
}

/** Extended agent detail combining Agent data with charter and history. */
export interface AgentDetail extends Agent {
  /** Path to the agent's charter file, if it exists. */
  charterPath: string | null;
  /** Parsed identity from charter. */
  identity: AgentIdentity;
  /** Parsed boundaries from charter. */
  boundaries: AgentBoundaries;
  /** Learning entries from the agent's history file. */
  learnings: string[];
}
