/**
 * Checkpoint — persistence interfaces and helpers for DAG workflow
 * execution state. Includes an in-memory implementation for testing.
 */

import type {
  CheckpointMetadata,
  CheckpointStore,
  EnhancedWorkflowExecutionState,
  EnhancedWorkflowExecutionStatus,
} from '../types/dag-workflow.js';

// ── Crash Recovery ──────────────────────────────────────────────

/**
 * Reset in-flight nodes after a crash. Nodes that were `running`, `queued`,
 * or `retrying` at crash time are reset to `pending` so the engine can
 * re-execute them.
 */
export function recoverState(
  state: EnhancedWorkflowExecutionState,
): EnhancedWorkflowExecutionState {
  const recovered = { ...state, nodeStates: { ...state.nodeStates } };

  for (const [nodeId, ns] of Object.entries(recovered.nodeStates)) {
    if (ns.status === 'running' || ns.status === 'queued' || ns.status === 'retrying') {
      recovered.nodeStates[nodeId] = {
        ...ns,
        status: 'pending',
        startedAt: null,
        completedAt: null,
      };
    }
  }

  recovered.status = 'running';
  return recovered;
}

/**
 * Serialize an execution state to a JSON string.
 * Secrets and toolRegistry references must be excluded before calling.
 */
export function serializeState(state: EnhancedWorkflowExecutionState): string {
  return JSON.stringify(state);
}

/**
 * Deserialize an execution state from a JSON string.
 * Performs basic structural validation.
 */
export function deserializeState(json: string): EnhancedWorkflowExecutionState {
  const parsed: unknown = JSON.parse(json);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid checkpoint: expected an object');
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj['executionId'] !== 'string') {
    throw new Error('Invalid checkpoint: missing executionId');
  }
  if (typeof obj['workflowId'] !== 'string') {
    throw new Error('Invalid checkpoint: missing workflowId');
  }
  if (!obj['nodeStates'] || typeof obj['nodeStates'] !== 'object') {
    throw new Error('Invalid checkpoint: missing nodeStates');
  }
  if (typeof obj['checkpointVersion'] !== 'number') {
    throw new Error('Invalid checkpoint: missing checkpointVersion');
  }

  return parsed as EnhancedWorkflowExecutionState;
}

// ── In-Memory Checkpoint Store ──────────────────────────────────

/**
 * In-memory CheckpointStore for testing and development.
 * NOT suitable for production — state is lost on process restart.
 */
export class InMemoryCheckpointStore implements CheckpointStore {
  private store = new Map<string, Map<number, { state: string; savedAt: string }>>();

  async save(state: EnhancedWorkflowExecutionState): Promise<void> {
    const versions = this.store.get(state.executionId) ?? new Map();
    const serialized = serializeState(state);
    versions.set(state.checkpointVersion, {
      state: serialized,
      savedAt: new Date().toISOString(),
    });
    this.store.set(state.executionId, versions);
  }

  async load(executionId: string): Promise<EnhancedWorkflowExecutionState | null> {
    const versions = this.store.get(executionId);
    if (!versions || versions.size === 0) return null;

    const maxVersion = Math.max(...versions.keys());
    const entry = versions.get(maxVersion);
    return entry ? deserializeState(entry.state) : null;
  }

  async loadVersion(
    executionId: string,
    version: number,
  ): Promise<EnhancedWorkflowExecutionState | null> {
    const entry = this.store.get(executionId)?.get(version);
    return entry ? deserializeState(entry.state) : null;
  }

  async listVersions(executionId: string): Promise<CheckpointMetadata[]> {
    const versions = this.store.get(executionId);
    if (!versions) return [];

    return [...versions.entries()]
      .map(([version, entry]) => {
        const state = deserializeState(entry.state);
        return {
          executionId,
          version,
          status: state.status,
          savedAt: entry.savedAt,
          sizeBytes: Buffer.byteLength(entry.state, 'utf8'),
        };
      })
      .sort((a, b) => b.version - a.version);
  }

  async delete(executionId: string): Promise<void> {
    this.store.delete(executionId);
  }

  async prune(executionId: string, keepLast: number): Promise<number> {
    const versions = this.store.get(executionId);
    if (!versions) return 0;

    const sorted = [...versions.keys()].sort((a, b) => b - a);
    const toDelete = sorted.slice(keepLast);

    for (const version of toDelete) {
      versions.delete(version);
    }

    return toDelete.length;
  }

  /** For testing: clear all stored checkpoints. */
  clear(): void {
    this.store.clear();
  }

  /** For testing: get the number of stored executions. */
  get size(): number {
    return this.store.size;
  }

  /**
   * For testing: get the number of checkpoint versions for an execution.
   */
  versionCount(executionId: string): number {
    return this.store.get(executionId)?.size ?? 0;
  }
}

// Re-export CheckpointStore type for convenience
export type { CheckpointMetadata, CheckpointStore, EnhancedWorkflowExecutionStatus };
