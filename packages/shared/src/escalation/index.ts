/**
 * Escalation Engine — Pure logic for HITL escalation management.
 *
 * No side effects, no I/O. All functions are deterministic and testable.
 */

import type {
  AuditEntry,
  ConfidenceThreshold,
  EscalationChain,
  EscalationChainLevel,
  EscalationContext,
  EscalationItem,
  EscalationPriority,
  EscalationQueueState,
  EscalationReason,
  EscalationStatus,
} from '../types/escalation.js';

// ── ID Generation ────────────────────────────────────────────────

let counter = 0;

export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++counter}`;
}

// ── Confidence Threshold Evaluation ──────────────────────────────

/**
 * Evaluate whether a confidence score should trigger escalation.
 *
 * Returns the matching threshold (with lowest threshold value, i.e. strictest)
 * or null if no escalation is needed.
 */
export function evaluateConfidence(
  score: number,
  thresholds: ConfidenceThreshold[],
  agentRole?: string,
): ConfidenceThreshold | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    throw new Error(`Invalid confidence score: ${score}`);
  }
  if (score < 0 || score > 1) {
    throw new Error(`Confidence score must be between 0 and 1, got: ${score}`);
  }

  const applicable = thresholds.filter((t) => {
    if (t.agentRoles && t.agentRoles.length > 0 && agentRole) {
      return t.agentRoles.includes(agentRole);
    }
    if (t.agentRoles && t.agentRoles.length > 0 && !agentRole) {
      return false;
    }
    return true;
  });

  const matching = applicable.filter((t) => score < t.threshold);
  if (matching.length === 0) return null;

  // Return the threshold with the highest value (least strict that still matches)
  return matching.reduce((best, t) => (t.threshold > best.threshold ? t : best));
}

/**
 * Check if a score is exactly at a threshold boundary.
 * At-threshold means the score equals the threshold exactly — NOT escalated.
 */
export function isAtThresholdBoundary(
  score: number,
  thresholds: ConfidenceThreshold[],
): boolean {
  return thresholds.some((t) => score === t.threshold);
}

// ── Timeout Calculations ─────────────────────────────────────────

/**
 * Calculate the timeout timestamp for a given escalation chain level.
 */
export function calculateTimeout(
  chain: EscalationChain,
  level: number,
  fromTimestamp: string,
): string {
  const chainLevel = resolveChainLevel(chain, level);
  if (!chainLevel) {
    throw new Error(`Level ${level} not found in chain "${chain.id}"`);
  }

  const from = new Date(fromTimestamp);
  if (isNaN(from.getTime())) {
    throw new Error(`Invalid timestamp: ${fromTimestamp}`);
  }

  return new Date(from.getTime() + chainLevel.timeoutMs).toISOString();
}

/**
 * Check if an escalation item has timed out.
 */
export function isTimedOut(item: EscalationItem, now: string): boolean {
  return new Date(now).getTime() >= new Date(item.timeoutAt).getTime();
}

/**
 * Calculate remaining time in milliseconds before timeout.
 * Returns 0 if already timed out.
 */
export function remainingTimeMs(item: EscalationItem, now: string): number {
  const remaining = new Date(item.timeoutAt).getTime() - new Date(now).getTime();
  return Math.max(0, remaining);
}

// ── Escalation Chain Resolution ──────────────────────────────────

/**
 * Resolve the chain level for a given level number.
 */
export function resolveChainLevel(
  chain: EscalationChain,
  level: number,
): EscalationChainLevel | null {
  return chain.levels.find((l) => l.level === level) ?? null;
}

/**
 * Get the next level in the chain. Returns null if at the last level.
 */
export function getNextChainLevel(
  chain: EscalationChain,
  currentLevel: number,
): EscalationChainLevel | null {
  const sorted = [...chain.levels].sort((a, b) => a.level - b.level);
  const currentIdx = sorted.findIndex((l) => l.level === currentLevel);
  if (currentIdx === -1 || currentIdx === sorted.length - 1) return null;
  return sorted[currentIdx + 1];
}

/**
 * Check if a reviewer is eligible to claim an item at the current chain level.
 */
export function isReviewerEligible(
  chain: EscalationChain,
  level: number,
  reviewerId: string,
): boolean {
  const chainLevel = resolveChainLevel(chain, level);
  if (!chainLevel) return false;
  return chainLevel.reviewerIds.includes(reviewerId);
}

// ── Escalation Item Creation ─────────────────────────────────────

/**
 * Create a new escalation item.
 */
export function createEscalationItem(params: {
  reason: EscalationReason;
  priority: EscalationPriority;
  chain: EscalationChain;
  context: EscalationContext;
  startLevel?: number;
  now?: string;
}): EscalationItem {
  const now = params.now ?? new Date().toISOString();
  const startLevel = params.startLevel ?? params.chain.levels[0]?.level ?? 1;
  const id = generateId('esc');

  const timeoutAt = calculateTimeout(params.chain, startLevel, now);

  const auditEntry: AuditEntry = {
    id: generateId('audit'),
    escalationId: id,
    action: 'created',
    actor: params.context.agentId,
    timestamp: now,
    details: `Escalation created: ${params.reason} (confidence: ${params.context.confidenceScore})`,
    newStatus: 'pending',
  };

  return {
    id,
    status: 'pending',
    reason: params.reason,
    priority: params.priority,
    chainId: params.chain.id,
    currentLevel: startLevel,
    context: params.context,
    claimedBy: null,
    claimedAt: null,
    createdAt: now,
    updatedAt: now,
    timeoutAt,
    reviewComment: null,
    auditTrail: [auditEntry],
  };
}

// ── State Transitions ────────────────────────────────────────────

/**
 * Claim an escalation item. Returns a new item (immutable).
 * Throws if the item cannot be claimed.
 */
export function claimEscalationItem(
  item: EscalationItem,
  reviewerId: string,
  chain: EscalationChain,
  now?: string,
): EscalationItem {
  const timestamp = now ?? new Date().toISOString();

  if (item.status !== 'pending') {
    throw new Error(`Cannot claim item in status "${item.status}". Must be "pending".`);
  }

  if (!isReviewerEligible(chain, item.currentLevel, reviewerId)) {
    throw new Error(
      `Reviewer "${reviewerId}" is not eligible for level ${item.currentLevel} of chain "${chain.id}".`,
    );
  }

  const auditEntry: AuditEntry = {
    id: generateId('audit'),
    escalationId: item.id,
    action: 'claimed',
    actor: reviewerId,
    timestamp,
    details: `Claimed by ${reviewerId}`,
    previousStatus: item.status,
    newStatus: 'claimed',
  };

  return {
    ...item,
    status: 'claimed',
    claimedBy: reviewerId,
    claimedAt: timestamp,
    updatedAt: timestamp,
    auditTrail: [...item.auditTrail, auditEntry],
  };
}

/**
 * Approve an escalation item. Returns a new item (immutable).
 */
export function approveEscalationItem(
  item: EscalationItem,
  reviewerId: string,
  comment?: string,
  now?: string,
): EscalationItem {
  const timestamp = now ?? new Date().toISOString();

  if (item.status !== 'claimed') {
    throw new Error(`Cannot approve item in status "${item.status}". Must be "claimed".`);
  }
  if (item.claimedBy !== reviewerId) {
    throw new Error(
      `Reviewer "${reviewerId}" cannot approve — item is claimed by "${item.claimedBy}".`,
    );
  }

  const auditEntry: AuditEntry = {
    id: generateId('audit'),
    escalationId: item.id,
    action: 'approved',
    actor: reviewerId,
    timestamp,
    details: comment ?? 'Approved',
    previousStatus: item.status,
    newStatus: 'approved',
  };

  return {
    ...item,
    status: 'approved',
    reviewComment: comment ?? null,
    updatedAt: timestamp,
    auditTrail: [...item.auditTrail, auditEntry],
  };
}

/**
 * Reject an escalation item. Returns a new item (immutable).
 */
export function rejectEscalationItem(
  item: EscalationItem,
  reviewerId: string,
  comment?: string,
  now?: string,
): EscalationItem {
  const timestamp = now ?? new Date().toISOString();

  if (item.status !== 'claimed') {
    throw new Error(`Cannot reject item in status "${item.status}". Must be "claimed".`);
  }
  if (item.claimedBy !== reviewerId) {
    throw new Error(
      `Reviewer "${reviewerId}" cannot reject — item is claimed by "${item.claimedBy}".`,
    );
  }

  const auditEntry: AuditEntry = {
    id: generateId('audit'),
    escalationId: item.id,
    action: 'rejected',
    actor: reviewerId,
    timestamp,
    details: comment ?? 'Rejected',
    previousStatus: item.status,
    newStatus: 'rejected',
  };

  return {
    ...item,
    status: 'rejected',
    reviewComment: comment ?? null,
    updatedAt: timestamp,
    auditTrail: [...item.auditTrail, auditEntry],
  };
}

/**
 * Auto-escalate a timed-out item to the next chain level.
 * Returns a new item, or null if there's no next level.
 */
export function autoEscalate(
  item: EscalationItem,
  chain: EscalationChain,
  now?: string,
): EscalationItem | null {
  const timestamp = now ?? new Date().toISOString();

  if (item.status !== 'pending' && item.status !== 'timed_out') {
    throw new Error(`Cannot auto-escalate item in status "${item.status}".`);
  }

  const nextLevel = getNextChainLevel(chain, item.currentLevel);
  if (!nextLevel) return null;

  const newTimeoutAt = calculateTimeout(chain, nextLevel.level, timestamp);

  const auditEntries: AuditEntry[] = [
    {
      id: generateId('audit'),
      escalationId: item.id,
      action: 'timed_out',
      actor: 'system',
      timestamp,
      details: `Level ${item.currentLevel} timed out`,
      previousStatus: item.status,
      newStatus: 'timed_out',
    },
    {
      id: generateId('audit'),
      escalationId: item.id,
      action: 'level_changed',
      actor: 'system',
      timestamp,
      details: `Auto-escalated from level ${item.currentLevel} to level ${nextLevel.level}`,
    },
    {
      id: generateId('audit'),
      escalationId: item.id,
      action: 'pending',
      actor: 'system',
      timestamp,
      details: `Waiting for level ${nextLevel.level} reviewer`,
      newStatus: 'pending',
    },
  ];

  return {
    ...item,
    status: 'pending',
    currentLevel: nextLevel.level,
    claimedBy: null,
    claimedAt: null,
    timeoutAt: newTimeoutAt,
    updatedAt: timestamp,
    auditTrail: [...item.auditTrail, ...auditEntries],
  };
}

// ── State Serialization ──────────────────────────────────────────

/**
 * Serialize the escalation queue state to a JSON-compatible object.
 */
export function serializeQueueState(
  items: EscalationItem[],
  chains: EscalationChain[],
  thresholds: ConfidenceThreshold[],
): EscalationQueueState {
  return {
    items: structuredClone(items),
    chains: structuredClone(chains),
    thresholds: structuredClone(thresholds),
    serializedAt: new Date().toISOString(),
    version: 1,
  };
}

/**
 * Deserialize queue state from a JSON-compatible object.
 * Validates the schema version and structure.
 */
export function deserializeQueueState(
  raw: unknown,
): EscalationQueueState {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid queue state: expected an object');
  }

  const state = raw as Record<string, unknown>;

  if (state.version !== 1) {
    throw new Error(`Unsupported queue state version: ${state.version}`);
  }

  if (!Array.isArray(state.items)) {
    throw new Error('Invalid queue state: "items" must be an array');
  }
  if (!Array.isArray(state.chains)) {
    throw new Error('Invalid queue state: "chains" must be an array');
  }
  if (!Array.isArray(state.thresholds)) {
    throw new Error('Invalid queue state: "thresholds" must be an array');
  }
  if (typeof state.serializedAt !== 'string') {
    throw new Error('Invalid queue state: "serializedAt" must be a string');
  }

  // Validate each item has required fields
  for (const item of state.items as Record<string, unknown>[]) {
    if (!item.id || !item.status || !item.context) {
      throw new Error(`Invalid escalation item: missing required fields (id, status, context)`);
    }
  }

  return state as unknown as EscalationQueueState;
}

/**
 * Validate an EscalationContext snapshot.
 * Returns an array of validation errors (empty if valid).
 */
export function validateContext(context: unknown): string[] {
  const errors: string[] = [];

  if (!context || typeof context !== 'object') {
    return ['Context must be a non-null object'];
  }

  const ctx = context as Record<string, unknown>;

  if (typeof ctx.agentId !== 'string' || ctx.agentId.trim() === '') {
    errors.push('agentId is required and must be a non-empty string');
  }
  if (typeof ctx.confidenceScore !== 'number' || !Number.isFinite(ctx.confidenceScore as number)) {
    errors.push('confidenceScore is required and must be a finite number');
  } else if ((ctx.confidenceScore as number) < 0 || (ctx.confidenceScore as number) > 1) {
    errors.push('confidenceScore must be between 0 and 1');
  }
  if (typeof ctx.sourceNodeId !== 'string' || ctx.sourceNodeId.trim() === '') {
    errors.push('sourceNodeId is required and must be a non-empty string');
  }
  if (typeof ctx.workflowId !== 'string' || ctx.workflowId.trim() === '') {
    errors.push('workflowId is required and must be a non-empty string');
  }
  if (typeof ctx.proposedAction !== 'string') {
    errors.push('proposedAction is required and must be a string');
  }
  if (typeof ctx.reasoning !== 'string') {
    errors.push('reasoning is required and must be a string');
  }
  if (ctx.metadata !== undefined && (typeof ctx.metadata !== 'object' || ctx.metadata === null)) {
    errors.push('metadata must be a non-null object if provided');
  }

  return errors;
}
