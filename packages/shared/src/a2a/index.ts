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
export type { MessageQuery } from './message-store.js';
export { A2AMessageStore } from './message-store.js';

// ── Message Bus / Router ─────────────────────────────────────────
export type {
  AgentInfo,
  AgentResolver,
  MessageBusOptions,
  MessageHandler,
} from './message-bus.js';
export { A2AMessageBus } from './message-bus.js';

// ── Delegation Engine ────────────────────────────────────────────
export type {
  DelegationEngineOptions,
  DelegationRequest,
  DelegationResult,
  SplitWorkPlan,
  SplitWorkResult,
} from './delegation-engine.js';
export { DelegationEngine } from './delegation-engine.js';

// ── Negotiation ──────────────────────────────────────────────────
export type {
  NegotiationManagerOptions,
  NegotiationProposal,
  NegotiationState,
  NegotiationTurn,
} from './negotiation.js';
export { NegotiationManager } from './negotiation.js';

// ── Status Broadcaster ───────────────────────────────────────────
export type {
  A2ABusEvent,
  A2ABusEventListener,
  A2ABusEventType,
} from './status-broadcaster.js';
export { StatusBroadcaster } from './status-broadcaster.js';

// ── Handoff ──────────────────────────────────────────────────────
export type {
  HandoffManagerOptions,
  HandoffRequest,
  HandoffResult,
  PendingHandoff,
} from './handoff.js';
export { HandoffManager } from './handoff.js';

// ── Correlation Tracker ──────────────────────────────────────────
export type {
  CorrelationStatus,
  SubTaskEntry,
} from './correlation-tracker.js';
export { CorrelationTracker, findSubTaskMessages } from './correlation-tracker.js';
