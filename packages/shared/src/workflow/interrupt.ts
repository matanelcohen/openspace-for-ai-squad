/**
 * HITL Interrupt Runtime — Core implementation for the interrupt model.
 *
 * Provides:
 * - `interrupt()` — function node handlers call to pause execution
 * - `InterruptError` — signal class thrown by interrupt() and caught by the engine
 * - `shouldInterrupt()` — evaluates declarative InterruptPolicy against node output
 * - `createInterruptState()` — builds the serialized interrupt snapshot
 * - `applyTimeoutPolicy()` — resolves timed-out interrupts automatically
 * - `serializeInterruptState()` / `deserializeInterruptState()` — JSON round-trip
 * - `buildContextSnapshot()` — captures ExecutionContext data for reviewer
 */

import type { ExecutionContext, SerializedContext, NodeOutput } from '../types/dag-workflow.js';
import type {
  ContextSnapshotConfig,
  InterruptChoice,
  InterruptPolicy,
  InterruptReason,
  InterruptRequest,
  InterruptResolution,
  InterruptState,
  InterruptTimeoutPolicy,
} from '../types/interrupt.js';

// ── InterruptError (Signal) ─────────────────────────────────────

/**
 * Thrown by `interrupt()` to signal the engine that a node wants to
 * pause for human review. The engine catches this (and only this)
 * to transition the node to 'paused' status.
 *
 * This is NOT a failure — it's a control flow signal, similar to
 * LangGraph's `NodeInterrupt`.
 */
export class InterruptError extends Error {
  /** Discriminator so the engine can identify this as an interrupt. */
  readonly __isInterrupt = true as const;

  constructor(public readonly request: InterruptRequest) {
    super(`Interrupt: ${request.message}`);
    this.name = 'InterruptError';
  }
}

/**
 * Type guard: check if an unknown error is an InterruptError.
 */
export function isInterruptError(err: unknown): err is InterruptError {
  return (
    err instanceof InterruptError ||
    (typeof err === 'object' &&
      err !== null &&
      '__isInterrupt' in err &&
      (err as { __isInterrupt: unknown }).__isInterrupt === true)
  );
}

// ── interrupt() — Primary API ───────────────────────────────────

/**
 * Call this from inside a node handler to pause execution and
 * request human review.
 *
 * @example
 * ```typescript
 * async function reviewDeployment(node, ctx) {
 *   const plan = await generateDeployPlan(ctx);
 *   if (plan.risk === 'high') {
 *     // Pause and ask a human to approve
 *     const decision = interrupt({
 *       reason: 'destructive_action',
 *       message: `Deploy to production affects ${plan.services.length} services`,
 *       confidenceScore: 0.6,
 *       proposedAction: plan,
 *       choices: [
 *         { id: 'approve', label: 'Approve deployment', value: true },
 *         { id: 'reject', label: 'Reject deployment', value: false },
 *         { id: 'modify', label: 'Modify plan', value: 'modify' },
 *       ],
 *       partialState: { plan },
 *     });
 *     // ↑ This throws InterruptError. Execution resumes here
 *     //   after the human resolves the interrupt. `decision` is
 *     //   never reached in the first pass — the engine re-invokes
 *     //   the handler with the resolution in ctx.vars.__interruptResolution.
 *   }
 *   return plan;
 * }
 * ```
 *
 * @throws InterruptError always — this function never returns normally.
 */
export function interrupt(request: InterruptRequest): never {
  validateInterruptRequest(request);
  throw new InterruptError(request);
}

// ── shouldInterrupt() — Policy Evaluator ────────────────────────

/**
 * Evaluates a declarative InterruptPolicy against a node's output
 * and the execution context. Returns an InterruptRequest if the
 * policy triggers, or null if execution should continue normally.
 *
 * Called by the engine after a node completes but before committing
 * the output to the execution state.
 */
export function shouldInterrupt(
  policy: InterruptPolicy,
  nodeOutput: unknown,
  nodeId: string,
): InterruptRequest | null {
  // Check confidence threshold
  if (policy.confidenceThreshold !== undefined) {
    const confidence = extractConfidence(nodeOutput);
    if (confidence !== null && confidence < policy.confidenceThreshold) {
      return {
        reason: 'confidence_below_threshold',
        message: renderPrompt(
          policy.reviewPrompt ??
            'Node {{nodeId}} output confidence ({{confidence}}) is below threshold',
          { nodeId, confidence: String(confidence), output: JSON.stringify(nodeOutput) },
        ),
        confidenceScore: confidence,
        proposedAction: nodeOutput,
      };
    }
  }

  // Check interruptWhen conditions
  if (policy.interruptWhen && policy.interruptWhen.length > 0) {
    for (const condition of policy.interruptWhen) {
      if (evaluateSimpleCondition(condition, nodeOutput)) {
        return {
          reason: 'safety_check',
          message: renderPrompt(
            policy.reviewPrompt ??
              `Node {{nodeId}} triggered interrupt condition: ${condition}`,
            { nodeId, confidence: '0', output: JSON.stringify(nodeOutput) },
          ),
          confidenceScore: 0,
          proposedAction: nodeOutput,
        };
      }
    }
  }

  return null;
}

// ── createInterruptState() ──────────────────────────────────────

/**
 * Creates a serializable InterruptState from an interrupt request
 * and execution context. This is stored in the checkpoint.
 */
export function createInterruptState(params: {
  nodeId: string;
  executionId: string;
  request: InterruptRequest;
  timeoutPolicy?: InterruptTimeoutPolicy | null;
  now?: string;
}): InterruptState {
  const now = params.now ?? new Date().toISOString();
  const timeoutAt = params.timeoutPolicy
    ? new Date(new Date(now).getTime() + params.timeoutPolicy.timeoutMs).toISOString()
    : null;

  return {
    id: generateInterruptId(),
    nodeId: params.nodeId,
    executionId: params.executionId,
    request: params.request,
    escalationId: null,
    status: 'pending',
    resolution: null,
    createdAt: now,
    timeoutAt,
    timeoutPolicy: params.timeoutPolicy ?? null,
  };
}

// ── applyTimeoutPolicy() ────────────────────────────────────────

/**
 * Checks if an interrupt has timed out and applies the default action.
 * Returns the updated InterruptState if a timeout occurred, or null
 * if the interrupt is still within its timeout window.
 */
export function applyTimeoutPolicy(
  state: InterruptState,
  now?: string,
): InterruptState | null {
  if (!state.timeoutAt || !state.timeoutPolicy) return null;
  if (state.status !== 'pending' && state.status !== 'claimed') return null;

  const currentTime = now ?? new Date().toISOString();
  if (new Date(currentTime) < new Date(state.timeoutAt)) return null;

  const resolution = resolveTimeout(state.timeoutPolicy, state.request);

  return {
    ...state,
    status: state.timeoutPolicy.defaultAction === 'escalate' ? 'timed_out' : 'auto_resolved',
    resolution,
  };
}

// ── buildContextSnapshot() ──────────────────────────────────────

/**
 * Captures a subset of the ExecutionContext for reviewer inspection,
 * guided by the ContextSnapshotConfig.
 */
export function buildContextSnapshot(
  ctx: ExecutionContext,
  config?: ContextSnapshotConfig,
): SerializedContext {
  const snapshot: SerializedContext = {
    vars: {},
    nodeOutputs: {},
    startedAt: ctx.startedAt,
    traceId: ctx.traceId,
  };

  // Include vars (default: yes)
  if (config?.includeVars !== false) {
    snapshot.vars = { ...ctx.vars };
  }

  // Include node outputs
  const outputMode = config?.includeNodeOutputs ?? 'all';
  if (outputMode === 'all') {
    snapshot.nodeOutputs = { ...ctx.nodeOutputs };
  } else if (Array.isArray(outputMode)) {
    for (const nodeId of outputMode) {
      if (ctx.nodeOutputs[nodeId]) {
        snapshot.nodeOutputs[nodeId] = ctx.nodeOutputs[nodeId];
      }
    }
  }
  // 'none' → leave empty

  // Apply size limit
  if (config?.maxSizeBytes) {
    const json = JSON.stringify(snapshot);
    if (json.length > config.maxSizeBytes) {
      // Truncate node outputs first (largest data)
      snapshot.nodeOutputs = truncateOutputs(
        snapshot.nodeOutputs,
        config.maxSizeBytes,
      );
    }
  }

  return snapshot;
}

// ── Serialization ───────────────────────────────────────────────

/**
 * Serialize an InterruptState to a plain JSON-safe object.
 * Already JSON-safe by design, but this provides a validation step.
 */
export function serializeInterruptState(state: InterruptState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize an InterruptState from JSON.
 * Validates required fields are present.
 */
export function deserializeInterruptState(raw: string): InterruptState {
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  const requiredFields = ['id', 'nodeId', 'executionId', 'request', 'status', 'createdAt'];
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      throw new Error(`Invalid InterruptState: missing field "${field}"`);
    }
  }

  return parsed as unknown as InterruptState;
}

// ── Validation ──────────────────────────────────────────────────

/**
 * Validates an InterruptRequest has all required fields and
 * confidenceScore is in range.
 */
export function validateInterruptRequest(request: InterruptRequest): void {
  if (!request.reason) {
    throw new Error('InterruptRequest.reason is required');
  }
  if (!request.message || typeof request.message !== 'string') {
    throw new Error('InterruptRequest.message must be a non-empty string');
  }
  if (
    typeof request.confidenceScore !== 'number' ||
    request.confidenceScore < 0 ||
    request.confidenceScore > 1
  ) {
    throw new Error('InterruptRequest.confidenceScore must be a number between 0 and 1');
  }
  if (request.choices) {
    validateChoices(request.choices);
  }
}

// ── Internal Helpers ────────────────────────────────────────────

function validateChoices(choices: InterruptChoice[]): void {
  const ids = new Set<string>();
  for (const choice of choices) {
    if (!choice.id || !choice.label) {
      throw new Error('Each InterruptChoice must have an id and label');
    }
    if (ids.has(choice.id)) {
      throw new Error(`Duplicate InterruptChoice id: "${choice.id}"`);
    }
    ids.add(choice.id);
  }
}

/**
 * Extract a confidence score from a node's output.
 * Looks for `confidenceScore`, `confidence`, or `score` fields.
 */
function extractConfidence(output: unknown): number | null {
  if (typeof output !== 'object' || output === null) return null;
  const obj = output as Record<string, unknown>;
  for (const key of ['confidenceScore', 'confidence', 'score']) {
    if (typeof obj[key] === 'number') return obj[key] as number;
  }
  return null;
}

/**
 * Evaluate a simple condition string against a node output.
 * Supports basic dot-path comparisons:
 *   "output.risk === 'high'"
 *   "output.cost > 1000"
 */
function evaluateSimpleCondition(condition: string, output: unknown): boolean {
  // Parse simple comparison patterns: field op value
  const match = condition.match(
    /^output\.(\S+)\s*(===|!==|>|>=|<|<=)\s*(.+)$/,
  );
  if (!match) return false;

  const [, fieldPath, operator, rawValue] = match;
  const actual = resolveFieldPath(fieldPath!, output);
  const expected = parseValue(rawValue!.trim());

  switch (operator) {
    case '===': return actual === expected;
    case '!==': return actual !== expected;
    case '>': return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case '>=': return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case '<': return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case '<=': return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    default: return false;
  }
}

function resolveFieldPath(path: string, obj: unknown): unknown {
  let current = obj;
  for (const part of path.split('.')) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function parseValue(raw: string): unknown {
  // String literal
  if ((raw.startsWith("'") && raw.endsWith("'")) || (raw.startsWith('"') && raw.endsWith('"'))) {
    return raw.slice(1, -1);
  }
  // Boolean
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  // Null
  if (raw === 'null') return null;
  // Number
  const num = Number(raw);
  if (!isNaN(num)) return num;
  // Fall back to string
  return raw;
}

function renderPrompt(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

function resolveTimeout(
  policy: InterruptTimeoutPolicy,
  request: InterruptRequest,
): InterruptResolution {
  const now = new Date().toISOString();

  switch (policy.defaultAction) {
    case 'approve':
      return {
        action: 'approve',
        output: request.proposedAction,
        comment: 'Auto-approved due to timeout',
        reviewerId: 'system',
        resolvedAt: now,
      };
    case 'reject':
      return {
        action: 'reject',
        output: 'Timed out waiting for human review',
        comment: 'Auto-rejected due to timeout',
        reviewerId: 'system',
        resolvedAt: now,
      };
    case 'skip':
      return {
        action: 'reject',
        output: null,
        comment: 'Skipped due to timeout',
        reviewerId: 'system',
        resolvedAt: now,
      };
    case 'use_default':
      return {
        action: 'approve',
        output: policy.defaultValue,
        comment: 'Used default value due to timeout',
        reviewerId: 'system',
        resolvedAt: now,
      };
    case 'escalate':
      return {
        action: 'delegate',
        comment: 'Auto-escalated to next level due to timeout',
        reviewerId: 'system',
        resolvedAt: now,
      };
  }
}

function truncateOutputs(
  outputs: Record<string, NodeOutput>,
  maxBytes: number,
): Record<string, NodeOutput> {
  const entries = Object.entries(outputs);
  const truncated: Record<string, NodeOutput> = {};
  let currentSize = 2; // "{}"

  for (const [key, value] of entries) {
    const entryJson = JSON.stringify({ [key]: value });
    if (currentSize + entryJson.length > maxBytes) break;
    truncated[key] = value;
    currentSize += entryJson.length;
  }

  return truncated;
}

let interruptCounter = 0;

function generateInterruptId(): string {
  interruptCounter++;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `int-${timestamp}-${random}-${interruptCounter}`;
}

/** Reset counter (for testing). */
export function _resetInterruptCounter(): void {
  interruptCounter = 0;
}
