/**
 * HITLManager — Stateful orchestrator for the HITL escalation lifecycle.
 *
 * Wraps the pure escalation functions with in-memory item storage and
 * provides the complete approve/reject/escalate workflow:
 *
 *   trigger → create → claim → approve|reject → resume
 *                                  ↑
 *                         timeout → auto-escalate
 *
 * Pure & side-effect-free (no I/O). Storage is in-memory — plug a
 * persistent adapter for production use via the `onItemChanged` hook.
 */

import type {
  AuditEntry,
  ConfidenceThreshold,
  EscalationChain,
  EscalationContext,
  EscalationItem,
  EscalationPriority,
  EscalationReason,
  EscalationStatus,
} from '../types/escalation.js';
import type { InterruptState } from '../types/interrupt.js';
import {
  approveEscalationItem,
  autoEscalate,
  claimEscalationItem,
  createEscalationItem,
  evaluateConfidence,
  rejectEscalationItem,
} from './index.js';

// ── Configuration ───────────────────────────────────────────────

export interface HITLManagerConfig {
  /** Escalation chains keyed by ID. */
  chains: EscalationChain[];

  /** Confidence thresholds. Evaluated in order of applicability. */
  thresholds: ConfidenceThreshold[];

  /** Default chain ID when no specific chain is specified. */
  defaultChainId?: string;

  /**
   * Called whenever an item is created or updated.
   * Use for persistence, notifications, or event bus integration.
   */
  onItemChanged?: (item: EscalationItem, event: EscalationLifecycleEvent) => void;
}

export type EscalationLifecycleEvent =
  | 'created'
  | 'claimed'
  | 'approved'
  | 'rejected'
  | 'timed_out'
  | 'auto_escalated';

// ── HITLManager ─────────────────────────────────────────────────

export class HITLManager {
  private items = new Map<string, EscalationItem>();
  private config: HITLManagerConfig;
  private chainMap: Map<string, EscalationChain>;

  constructor(config: HITLManagerConfig) {
    this.config = config;
    this.chainMap = new Map(config.chains.map((c) => [c.id, c]));
  }

  // ── Chain Resolution ──────────────────────────────────────────

  getChain(chainId: string): EscalationChain {
    const chain = this.chainMap.get(chainId);
    if (!chain) throw new Error(`Escalation chain "${chainId}" not found`);
    return chain;
  }

  /**
   * Resolve a chain by ID, falling back to the configured default chain.
   * Public API used by DAG integration callbacks.
   */
  resolveChainOrDefault(chainId?: string): EscalationChain {
    const id = chainId ?? this.config.defaultChainId;
    if (!id) throw new Error('No chain ID provided and no default chain configured');
    return this.getChain(id);
  }

  private resolveChain(chainId?: string): EscalationChain {
    return this.resolveChainOrDefault(chainId);
  }

  // ── Trigger Escalation ────────────────────────────────────────

  /**
   * Evaluate an agent's confidence score against configured thresholds.
   * If below threshold, creates an escalation item and returns it.
   * Returns null if no escalation is needed.
   */
  evaluateAndTrigger(params: {
    context: EscalationContext;
    agentRole?: string;
    chainId?: string;
    now?: string;
  }): EscalationItem | null {
    const matched = evaluateConfidence(
      params.context.confidenceScore,
      this.config.thresholds,
      params.agentRole,
    );

    if (!matched) return null;

    const chain = this.resolveChain(params.chainId);
    return this.createItem({
      reason: 'low_confidence',
      priority: this.priorityFromConfidence(params.context.confidenceScore),
      chain,
      context: params.context,
      startLevel: matched.escalationLevel,
      now: params.now,
    });
  }

  /**
   * Explicitly create an escalation item (e.g., from a HITL gate node
   * or an explicit agent request).
   */
  createItem(params: {
    reason: EscalationReason;
    priority: EscalationPriority;
    chain: EscalationChain;
    context: EscalationContext;
    startLevel?: number;
    now?: string;
  }): EscalationItem {
    const item = createEscalationItem(params);
    this.items.set(item.id, item);
    this.notify(item, 'created');
    return item;
  }

  /**
   * Create an escalation item from an interrupt state.
   * Bridges the interrupt model with the escalation queue.
   */
  triggerFromInterrupt(params: {
    interrupt: InterruptState;
    chainId?: string;
    priority?: EscalationPriority;
    now?: string;
  }): EscalationItem {
    const chain = this.resolveChain(params.chainId);
    const req = params.interrupt.request;

    const context: EscalationContext = {
      agentId: `node:${params.interrupt.nodeId}`,
      confidenceScore: req.confidenceScore,
      sourceNodeId: params.interrupt.nodeId,
      workflowId: params.interrupt.executionId,
      proposedAction:
        typeof req.proposedAction === 'string'
          ? req.proposedAction
          : JSON.stringify(req.proposedAction),
      reasoning: req.reasoning ?? req.message,
      metadata: {
        interruptId: params.interrupt.id,
        interruptReason: req.reason,
        ...(req.metadata ?? {}),
      },
    };

    return this.createItem({
      reason: this.mapInterruptReason(req.reason),
      priority: params.priority ?? 'medium',
      chain,
      context,
      now: params.now,
    });
  }

  // ── State Transitions ─────────────────────────────────────────

  /**
   * A reviewer claims an item for review.
   */
  claim(itemId: string, reviewerId: string, chainId?: string, now?: string): EscalationItem {
    const item = this.getItem(itemId);
    const chain = this.resolveChain(chainId ?? item.chainId);
    const updated = claimEscalationItem(item, reviewerId, chain, now);
    this.items.set(itemId, updated);
    this.notify(updated, 'claimed');
    return updated;
  }

  /**
   * Approve an escalation item.
   */
  approve(itemId: string, reviewerId: string, comment?: string, now?: string): EscalationItem {
    const item = this.getItem(itemId);
    const updated = approveEscalationItem(item, reviewerId, comment, now);
    this.items.set(itemId, updated);
    this.notify(updated, 'approved');
    return updated;
  }

  /**
   * Reject an escalation item.
   */
  reject(itemId: string, reviewerId: string, comment?: string, now?: string): EscalationItem {
    const item = this.getItem(itemId);
    const updated = rejectEscalationItem(item, reviewerId, comment, now);
    this.items.set(itemId, updated);
    this.notify(updated, 'rejected');
    return updated;
  }

  // ── Timeout Processing ────────────────────────────────────────

  /**
   * Process all timed-out items. Auto-escalates to the next chain level
   * or marks as timed_out if no further levels exist.
   *
   * Returns the list of items that were modified.
   */
  processTimeouts(now?: string): EscalationItem[] {
    const timestamp = now ?? new Date().toISOString();
    const modified: EscalationItem[] = [];

    for (const item of this.items.values()) {
      if (item.status !== 'pending') continue;
      if (new Date(timestamp) < new Date(item.timeoutAt)) continue;

      const chain = this.chainMap.get(item.chainId);
      if (!chain) continue;

      const escalated = autoEscalate(item, chain, timestamp);
      if (escalated) {
        this.items.set(item.id, escalated);
        this.notify(escalated, 'auto_escalated');
        modified.push(escalated);
      } else {
        // No more levels — mark as timed_out
        const timedOut: EscalationItem = {
          ...item,
          status: 'timed_out',
          updatedAt: timestamp,
          auditTrail: [
            ...item.auditTrail,
            {
              id: `audit-timeout-${Date.now()}`,
              escalationId: item.id,
              action: 'timed_out',
              actor: 'system',
              timestamp,
              details: 'Final level timed out with no further escalation levels',
              previousStatus: item.status,
              newStatus: 'timed_out',
            },
          ],
        };
        this.items.set(item.id, timedOut);
        this.notify(timedOut, 'timed_out');
        modified.push(timedOut);
      }
    }

    return modified;
  }

  // ── Queries ───────────────────────────────────────────────────

  getItem(itemId: string): EscalationItem {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`Escalation item "${itemId}" not found`);
    return item;
  }

  findItem(itemId: string): EscalationItem | null {
    return this.items.get(itemId) ?? null;
  }

  getAllItems(): EscalationItem[] {
    return [...this.items.values()];
  }

  getItemsByStatus(...statuses: EscalationStatus[]): EscalationItem[] {
    const statusSet = new Set(statuses);
    return [...this.items.values()].filter((i) => statusSet.has(i.status));
  }

  getAuditTrail(itemId: string): AuditEntry[] {
    return this.getItem(itemId).auditTrail;
  }

  /**
   * Get a complete audit trail across all items, sorted by timestamp.
   */
  getGlobalAuditTrail(): AuditEntry[] {
    const entries: AuditEntry[] = [];
    for (const item of this.items.values()) {
      entries.push(...item.auditTrail);
    }
    return entries.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
  }

  /** Total number of managed items. */
  get size(): number {
    return this.items.size;
  }

  /** Clear all items (useful for testing). */
  clear(): void {
    this.items.clear();
  }

  // ── Internal Helpers ──────────────────────────────────────────

  private notify(item: EscalationItem, event: EscalationLifecycleEvent): void {
    this.config.onItemChanged?.(item, event);
  }

  private priorityFromConfidence(score: number): EscalationPriority {
    if (score < 0.2) return 'critical';
    if (score < 0.4) return 'high';
    if (score < 0.6) return 'medium';
    return 'low';
  }

  private mapInterruptReason(reason: string): EscalationReason {
    switch (reason) {
      case 'low_confidence':
      case 'confidence_below_threshold':
        return 'low_confidence';
      case 'explicit_request':
        return 'explicit_request';
      case 'policy_violation':
      case 'safety_check':
        return 'policy_violation';
      case 'timeout':
        return 'timeout';
      default:
        return 'explicit_request';
    }
  }
}
