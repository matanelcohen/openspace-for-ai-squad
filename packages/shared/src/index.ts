/**
 * @openspace/shared — Shared types, constants, and utilities.
 *
 * This package is the contract between frontend and backend.
 * Types defined here are the source of truth for both apps.
 */

// ── Types ──────────────────────────────────────────────────────────
export type {
  ActivityEvent,
  ActivityEventType,
  Agent,
  AgentBoundaries,
  AgentDetail,
  AgentIdentity,
  AgentStatus,
  ChatMessage,
  Decision,
  DecisionStatus,
  SquadConfig,
  SquadOverview,
  Task,
  TaskCounts,
  TaskPriority,
  TaskStatus,
  VoiceMessage,
  VoiceParticipantRole,
  VoiceProfile,
  VoiceSession,
  VoiceSessionStatus,
} from './types/index.js';

// ── Constants ──────────────────────────────────────────────────────
export type { AgentRole } from './constants/index.js';
export {
  ACTIVITY_EVENT_TYPE_LABELS,
  ACTIVITY_EVENT_TYPES,
  AGENT_ROLES,
  AGENT_STATUS_LABELS,
  AGENT_STATUSES,
  CHAT_TEAM_RECIPIENT,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
} from './constants/index.js';
