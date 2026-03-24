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
  TaskAssigneeType,
  TaskCounts,
  TaskPriority,
  TaskStatus,
  TeamMember,
  TeamMemberRank,
  TeamMemberStatus,
  VoiceMessage,
  VoiceParticipantRole,
  VoiceProfile,
  VoiceSession,
  VoiceSessionStatus,
} from './types/index.js';

// ── Constants ──────────────────────────────────────────────────────
export type { AgentRole, Department } from './constants/index.js';
export {
  ACTIVITY_EVENT_TYPE_LABELS,
  ACTIVITY_EVENT_TYPES,
  AGENT_ROLES,
  AGENT_STATUS_LABELS,
  AGENT_STATUSES,
  CHAT_TEAM_RECIPIENT,
  DEPARTMENTS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  TEAM_MEMBER_RANK_LABELS,
  TEAM_MEMBER_RANKS,
  TEAM_MEMBER_STATUS_LABELS,
  TEAM_MEMBER_STATUSES,
} from './constants/index.js';
