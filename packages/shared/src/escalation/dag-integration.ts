/**
 * DAG Integration — Factory functions to wire HITLManager into the
 * DAG Workflow Engine's callback-based configuration.
 *
 * Bridges the gap between:
 *   - DAGWorkflowEngineConfig.onHITLGate / resolveEscalation (callbacks)
 *   - HITLManager's richer object-oriented API
 *
 * Usage:
 * ```typescript
 * const manager = new HITLManager({ chains, thresholds });
 * const callbacks = createHITLCallbacks(manager);
 *
 * const engine = new DAGWorkflowEngine({
 *   ...otherConfig,
 *   onHITLGate: callbacks.onHITLGate,
 *   resolveEscalation: callbacks.resolveEscalation,
 * });
 * ```
 */

import type {
  ExecutionContext,
  StepNode,
} from '../types/dag-workflow.js';
import type {
  EscalationPriority,
  EscalationReason,
  HITLGateNodeConfig,
} from '../types/escalation.js';
import type { HITLManager } from './hitl-manager.js';

// ── Callback types matching DAGWorkflowEngineConfig ─────────────

export interface HITLCallbacks {
  /**
   * Called by the DAG engine when a `hitl_gate` node is reached.
   * Creates an escalation item and returns its ID.
   */
  onHITLGate: (
    node: StepNode,
    executionId: string,
    ctx: ExecutionContext,
  ) => Promise<string>;

  /**
   * Called by the DAG engine when resuming a paused workflow.
   * Looks up the escalation resolution.
   */
  resolveEscalation: (
    escalationId: string,
  ) => Promise<{ approved: boolean; output?: unknown }>;
}

export interface CreateHITLCallbacksOptions {
  /** Default priority for HITL gate escalations. */
  defaultPriority?: EscalationPriority;

  /** Default escalation reason for HITL gates. */
  defaultReason?: EscalationReason;

  /** Default chain ID (overrides HITLManager's default). */
  defaultChainId?: string;

  /** Default confidence score for HITL gate nodes (0–1). Defaults to 0.5. */
  defaultConfidence?: number;
}

// ── Factory ─────────────────────────────────────────────────────

/**
 * Create DAG engine-compatible callbacks backed by an HITLManager.
 */
export function createHITLCallbacks(
  manager: HITLManager,
  options?: CreateHITLCallbacksOptions,
): HITLCallbacks {
  const defaultPriority = options?.defaultPriority ?? 'medium';
  const defaultReason = options?.defaultReason ?? 'explicit_request';
  const defaultConfidence = options?.defaultConfidence ?? 0.5;

  return {
    onHITLGate: async (
      node: StepNode,
      executionId: string,
      ctx: ExecutionContext,
    ): Promise<string> => {
      const config = (node.config ?? {}) as HITLGateNodeConfig;
      const chainId = config.escalationChainId
        ?? options?.defaultChainId;

      // Use resolveChain (public API) which handles default chain fallback
      const chain = manager.resolveChainOrDefault(chainId);

      const item = manager.createItem({
        reason: (config as { reason?: EscalationReason }).reason ?? defaultReason,
        priority: (config as { priority?: EscalationPriority }).priority ?? defaultPriority,
        chain,
        context: {
          agentId: `workflow:${ctx.workflowId}`,
          confidenceScore: defaultConfidence,
          sourceNodeId: node.id,
          workflowId: ctx.workflowId,
          proposedAction: config.prompt ?? `HITL gate: ${node.label}`,
          reasoning: config.prompt ?? `Awaiting human approval at gate "${node.label}"`,
          metadata: {
            executionId,
            nodeId: node.id,
            nodeLabel: node.label,
            traceId: ctx.traceId,
          },
        },
      });

      return item.id;
    },

    resolveEscalation: async (
      escalationId: string,
    ): Promise<{ approved: boolean; output?: unknown }> => {
      const item = manager.getItem(escalationId);

      switch (item.status) {
        case 'approved':
          return { approved: true, output: item.reviewComment };
        case 'rejected':
          return { approved: false, output: item.reviewComment };
        case 'timed_out':
          return { approved: false, output: 'Escalation timed out' };
        case 'auto_escalated':
          throw new Error(
            `Escalation "${escalationId}" has been auto-escalated to the next level and is not yet resolved`,
          );
        default:
          throw new Error(
            `Escalation "${escalationId}" is not yet resolved (status: ${item.status})`,
          );
      }
    },
  };
}
