/**
 * @openspace/shared — A2A Message Bus & Delegation Engine.
 *
 * Pure-logic implementation of the A2A protocol: message routing,
 * delegation with work splitting, negotiation flows, status broadcasting,
 * handoff mechanism, and correlation tracking.
 *
 * No external dependencies — uses event emitter pattern for integration.
 */

// ── Message Store ────────────────────────────────────────────────
export { A2AMessageStore } from './message-store.js';
export type { MessageQuery } from './message-store.js';

// ── Message Bus / Router ─────────────────────────────────────────
export { A2AMessageBus } from './message-bus.js';
export type {
  AgentInfo,
  AgentResolver,
  MessageBusOptions,
  MessageHandler,
} from './message-bus.js';

// ── Delegation Engine ────────────────────────────────────────────
export { DelegationEngine } from './delegation-engine.js';
export type {
  DelegationEngineOptions,
  DelegationRequest,
  DelegationResult,
  SplitWorkPlan,
  SplitWorkResult,
} from './delegation-engine.js';

// ── Negotiation ──────────────────────────────────────────────────
export { NegotiationManager } from './negotiation.js';
export type {
  NegotiationManagerOptions,
  NegotiationProposal,
  NegotiationState,
  NegotiationTurn,
} from './negotiation.js';

// ── Status Broadcaster ───────────────────────────────────────────
export { StatusBroadcaster } from './status-broadcaster.js';
export type {
  A2ABusEvent,
  A2ABusEventListener,
  A2ABusEventType,
} from './status-broadcaster.js';

// ── Handoff ──────────────────────────────────────────────────────
export { HandoffManager } from './handoff.js';
export type {
  HandoffManagerOptions,
  HandoffRequest,
  HandoffResult,
  PendingHandoff,
} from './handoff.js';

// ── Correlation Tracker ──────────────────────────────────────────
export { CorrelationTracker, findSubTaskMessages } from './correlation-tracker.js';
export type {
  CorrelationStatus,
  SubTaskEntry,
} from './correlation-tracker.js';
