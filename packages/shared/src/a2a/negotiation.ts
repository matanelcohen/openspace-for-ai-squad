/**
 * Negotiation flow — state machine for agent-to-agent negotiation.
 *
 * Supports: propose → counter/accept/reject/withdraw → finalize.
 * Used when agents need to agree on task ownership, resource sharing,
 * or scope modifications.
 */

import type {
  A2AMessagePriority,
  A2ANegotiation,
  A2ANegotiationPayload,
  A2ANegotiationPhase,
  A2ARetryPolicy,
} from '../types/a2a.js';
import { A2A_DEFAULT_RETRY_POLICY, A2A_PROTOCOL_VERSION } from '../types/a2a.js';

import type { A2AMessageBus } from './message-bus.js';
import type { StatusBroadcaster } from './status-broadcaster.js';

// ── Types ────────────────────────────────────────────────────────

/** Tracked state of a negotiation thread. */
export interface NegotiationState {
  negotiationId: string;
  correlationId: string;
  subject: string;
  /** Agent who initiated the negotiation. */
  initiatorId: string;
  /** Current phase. */
  phase: A2ANegotiationPhase;
  /** All participants in this negotiation. */
  participants: Set<string>;
  /** Ordered history of proposals/responses. */
  history: NegotiationTurn[];
  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last update timestamp. */
  updatedAt: string;
  /** Maximum number of counter rounds allowed (default: 5). */
  maxRounds: number;
}

export interface NegotiationTurn {
  /** The negotiation message for this turn. */
  message: A2ANegotiation;
  /** Phase of this turn. */
  phase: A2ANegotiationPhase;
  /** Agent who made this turn. */
  agentId: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
}

export interface NegotiationProposal {
  /** Agent initiating the negotiation. */
  fromAgentId: string;
  /** Target agent (or routing info). */
  toAgentId: string;
  /** What is being negotiated. */
  subject: string;
  /** The proposal details. */
  proposal: Record<string, unknown>;
  /** Reasoning/justification. */
  reasoning: string;
  /** Priority claim score (0–1). */
  claimScore?: number;
  /** Priority of the negotiation messages. */
  priority?: A2AMessagePriority;
  /** Max counter rounds (default: 5). */
  maxRounds?: number;
}

// ── Valid Phase Transitions ──────────────────────────────────────

const VALID_PHASE_TRANSITIONS: Record<A2ANegotiationPhase, A2ANegotiationPhase[]> = {
  propose: ['counter', 'accept', 'reject', 'withdraw'],
  counter: ['counter', 'accept', 'reject', 'withdraw'],
  accept: [], // terminal
  reject: [], // terminal
  withdraw: [], // terminal
};

// ── Negotiation Manager ──────────────────────────────────────────

export interface NegotiationManagerOptions {
  messageBus: A2AMessageBus;
  broadcaster?: StatusBroadcaster;
  generateId?: (prefix: string) => string;
}

let idCounter = 0;

function defaultGenerateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++idCounter}`;
}

export class NegotiationManager {
  private readonly bus: A2AMessageBus;
  private readonly broadcaster?: StatusBroadcaster;
  private readonly generateId: (prefix: string) => string;

  /** Active negotiations indexed by negotiationId. */
  private readonly negotiations = new Map<string, NegotiationState>();

  constructor(opts: NegotiationManagerOptions) {
    this.bus = opts.messageBus;
    this.broadcaster = opts.broadcaster;
    this.generateId = opts.generateId ?? defaultGenerateId;
  }

  // ── Initiate ─────────────────────────────────────────────────

  /** Start a new negotiation by sending a proposal. */
  async propose(proposal: NegotiationProposal): Promise<NegotiationState> {
    const negotiationId = this.generateId('neg');
    const correlationId = this.generateId('corr');
    const now = new Date().toISOString();

    const message = this.buildNegotiationMessage({
      negotiationId,
      correlationId,
      phase: 'propose',
      fromAgentId: proposal.fromAgentId,
      toAgentId: proposal.toAgentId,
      subject: proposal.subject,
      proposal: proposal.proposal,
      reasoning: proposal.reasoning,
      claimScore: proposal.claimScore,
      priority: proposal.priority,
    });

    const state: NegotiationState = {
      negotiationId,
      correlationId,
      subject: proposal.subject,
      initiatorId: proposal.fromAgentId,
      phase: 'propose',
      participants: new Set([proposal.fromAgentId, proposal.toAgentId]),
      history: [
        {
          message,
          phase: 'propose',
          agentId: proposal.fromAgentId,
          timestamp: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
      maxRounds: proposal.maxRounds ?? 5,
    };

    this.negotiations.set(negotiationId, state);
    await this.bus.send(message);

    this.broadcaster?.emit({
      type: 'negotiation:updated',
      message,
      data: { negotiationId, phase: 'propose' },
      timestamp: now,
    });

    return state;
  }

  // ── Respond ──────────────────────────────────────────────────

  /** Counter-propose in an existing negotiation. */
  async counter(
    negotiationId: string,
    agentId: string,
    proposal: Record<string, unknown>,
    reasoning: string,
    claimScore?: number,
  ): Promise<NegotiationState> {
    return this.advanceNegotiation(
      negotiationId,
      agentId,
      'counter',
      proposal,
      reasoning,
      claimScore,
    );
  }

  /** Accept the current proposal in a negotiation. */
  async accept(
    negotiationId: string,
    agentId: string,
    reasoning?: string,
  ): Promise<NegotiationState> {
    return this.advanceNegotiation(
      negotiationId,
      agentId,
      'accept',
      {},
      reasoning ?? 'Accepted',
    );
  }

  /** Reject the current proposal in a negotiation. */
  async reject(
    negotiationId: string,
    agentId: string,
    reasoning: string,
  ): Promise<NegotiationState> {
    return this.advanceNegotiation(negotiationId, agentId, 'reject', {}, reasoning);
  }

  /** Withdraw from a negotiation. */
  async withdraw(
    negotiationId: string,
    agentId: string,
    reasoning?: string,
  ): Promise<NegotiationState> {
    return this.advanceNegotiation(
      negotiationId,
      agentId,
      'withdraw',
      {},
      reasoning ?? 'Withdrawn',
    );
  }

  // ── Queries ──────────────────────────────────────────────────

  /** Get the current state of a negotiation. */
  getNegotiation(negotiationId: string): NegotiationState | undefined {
    return this.negotiations.get(negotiationId);
  }

  /** Check if a negotiation has reached a terminal phase. */
  isTerminal(negotiationId: string): boolean {
    const state = this.negotiations.get(negotiationId);
    if (!state) return true;
    return state.phase === 'accept' || state.phase === 'reject' || state.phase === 'withdraw';
  }

  /** Get the latest proposal from a negotiation. */
  getLatestProposal(negotiationId: string): NegotiationTurn | undefined {
    const state = this.negotiations.get(negotiationId);
    if (!state) return undefined;

    // Walk backwards to find the latest propose or counter
    for (let i = state.history.length - 1; i >= 0; i--) {
      const turn = state.history[i]!;
      if (turn.phase === 'propose' || turn.phase === 'counter') {
        return turn;
      }
    }
    return undefined;
  }

  /** Get all active (non-terminal) negotiations. */
  getActiveNegotiations(): NegotiationState[] {
    return Array.from(this.negotiations.values()).filter(
      (n) => n.phase !== 'accept' && n.phase !== 'reject' && n.phase !== 'withdraw',
    );
  }

  /** Remove a negotiation from tracking. */
  remove(negotiationId: string): boolean {
    return this.negotiations.delete(negotiationId);
  }

  // ── Private ──────────────────────────────────────────────────

  private async advanceNegotiation(
    negotiationId: string,
    agentId: string,
    phase: A2ANegotiationPhase,
    proposal: Record<string, unknown>,
    reasoning: string,
    claimScore?: number,
  ): Promise<NegotiationState> {
    const state = this.negotiations.get(negotiationId);
    if (!state) {
      throw new Error(`Negotiation not found: ${negotiationId}`);
    }

    // Validate phase transition
    if (!VALID_PHASE_TRANSITIONS[state.phase]?.includes(phase)) {
      throw new Error(
        `Invalid negotiation transition: ${state.phase} → ${phase}`,
      );
    }

    // Enforce max rounds for counter phase
    if (phase === 'counter') {
      const counterCount = state.history.filter((t) => t.phase === 'counter').length;
      if (counterCount >= state.maxRounds) {
        throw new Error(
          `Maximum counter rounds (${state.maxRounds}) reached for negotiation ${negotiationId}`,
        );
      }
    }

    // Determine the recipient (the other party)
    const lastTurn = state.history[state.history.length - 1]!;
    const toAgentId = lastTurn.agentId === agentId ? state.initiatorId : lastTurn.agentId;

    const now = new Date().toISOString();

    const message = this.buildNegotiationMessage({
      negotiationId,
      correlationId: state.correlationId,
      phase,
      fromAgentId: agentId,
      toAgentId,
      subject: state.subject,
      proposal,
      reasoning,
      claimScore,
    });

    state.phase = phase;
    state.participants.add(agentId);
    state.history.push({
      message,
      phase,
      agentId,
      timestamp: now,
    });
    state.updatedAt = now;

    await this.bus.send(message);

    this.broadcaster?.emit({
      type: 'negotiation:updated',
      message,
      data: { negotiationId, phase },
      timestamp: now,
    });

    return state;
  }

  private buildNegotiationMessage(params: {
    negotiationId: string;
    correlationId: string;
    phase: A2ANegotiationPhase;
    fromAgentId: string;
    toAgentId: string;
    subject: string;
    proposal: Record<string, unknown>;
    reasoning: string;
    claimScore?: number;
    priority?: A2AMessagePriority;
  }): A2ANegotiation {
    const messageId = this.generateId('a2a-neg');
    const now = new Date().toISOString();
    const ttlMs = A2A_DEFAULT_RETRY_POLICY.ttlMs;

    const payload: A2ANegotiationPayload = {
      negotiationId: params.negotiationId,
      phase: params.phase,
      subject: params.subject,
      proposal: params.proposal,
      reasoning: params.reasoning,
      claimScore: params.claimScore,
    };

    return {
      id: messageId,
      correlationId: params.correlationId,
      type: 'negotiation',
      sender: params.fromAgentId,
      recipient: params.toAgentId,
      routing: {
        strategy: 'direct',
        target: params.toAgentId,
      },
      priority: params.priority ?? 'normal',
      status: 'sent',
      payload,
      retryPolicy: A2A_DEFAULT_RETRY_POLICY,
      attemptCount: 1,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(Date.now() + ttlMs).toISOString(),
      protocolVersion: A2A_PROTOCOL_VERSION,
    };
  }
}
