import { describe, expect, it } from 'vitest';

import {
  InMemoryCheckpointStore,
  recoverState,
  serializeState,
  deserializeState,
} from '../workflow/checkpoint.js';
import type {
  EnhancedWorkflowExecutionState,
} from '../types/dag-workflow.js';

// ── Test Helpers ────────────────────────────────────────────────

function createTestState(
  overrides?: Partial<EnhancedWorkflowExecutionState>,
): EnhancedWorkflowExecutionState {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    workflowVersion: '1.0.0',
    status: 'running',
    nodeStates: {
      'node-a': {
        nodeId: 'node-a',
        status: 'completed',
        startedAt: '2026-01-01T00:00:00Z',
        completedAt: '2026-01-01T00:00:01Z',
        output: { data: 'a-result' },
        error: null,
        escalationId: null,
        attempt: 0,
        attempts: [],
        durationMs: 1000,
      },
      'node-b': {
        nodeId: 'node-b',
        status: 'pending',
        startedAt: null,
        completedAt: null,
        output: null,
        error: null,
        escalationId: null,
        attempt: 0,
        attempts: [],
        durationMs: null,
      },
    },
    contextSnapshot: {
      vars: { env: 'test' },
      nodeOutputs: {},
      startedAt: '2026-01-01T00:00:00Z',
      traceId: 'trace-1',
    },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:01Z',
    completedAt: null,
    checkpointVersion: 0,
    ...overrides,
  };
}

// ── InMemoryCheckpointStore Tests ───────────────────────────────

describe('InMemoryCheckpointStore', () => {
  it('save and load round-trips a state', async () => {
    const store = new InMemoryCheckpointStore();
    const state = createTestState();

    await store.save(state);
    const loaded = await store.load('exec-1');

    expect(loaded).not.toBeNull();
    expect(loaded!.executionId).toBe('exec-1');
    expect(loaded!.workflowId).toBe('wf-1');
    expect(loaded!.nodeStates['node-a']!.status).toBe('completed');
  });

  it('returns null for unknown execution ID', async () => {
    const store = new InMemoryCheckpointStore();
    expect(await store.load('nonexistent')).toBeNull();
  });

  it('loads the latest version by default', async () => {
    const store = new InMemoryCheckpointStore();

    await store.save(createTestState({ checkpointVersion: 0 }));
    await store.save(createTestState({ checkpointVersion: 1, status: 'completed' }));

    const loaded = await store.load('exec-1');
    expect(loaded!.checkpointVersion).toBe(1);
    expect(loaded!.status).toBe('completed');
  });

  it('loadVersion loads a specific version', async () => {
    const store = new InMemoryCheckpointStore();

    await store.save(createTestState({ checkpointVersion: 0 }));
    await store.save(createTestState({ checkpointVersion: 1, status: 'completed' }));

    const v0 = await store.loadVersion('exec-1', 0);
    expect(v0!.checkpointVersion).toBe(0);
    expect(v0!.status).toBe('running');

    const v1 = await store.loadVersion('exec-1', 1);
    expect(v1!.checkpointVersion).toBe(1);
    expect(v1!.status).toBe('completed');
  });

  it('loadVersion returns null for unknown version', async () => {
    const store = new InMemoryCheckpointStore();
    await store.save(createTestState({ checkpointVersion: 0 }));
    expect(await store.loadVersion('exec-1', 99)).toBeNull();
  });

  it('listVersions returns metadata sorted by version descending', async () => {
    const store = new InMemoryCheckpointStore();

    await store.save(createTestState({ checkpointVersion: 0 }));
    await store.save(createTestState({ checkpointVersion: 1, status: 'paused' }));
    await store.save(createTestState({ checkpointVersion: 2, status: 'completed' }));

    const versions = await store.listVersions('exec-1');
    expect(versions).toHaveLength(3);
    expect(versions[0]!.version).toBe(2);
    expect(versions[0]!.status).toBe('completed');
    expect(versions[2]!.version).toBe(0);
    expect(versions.every((v) => v.executionId === 'exec-1')).toBe(true);
    expect(versions.every((v) => typeof v.sizeBytes === 'number')).toBe(true);
  });

  it('listVersions returns empty for unknown execution', async () => {
    const store = new InMemoryCheckpointStore();
    expect(await store.listVersions('nonexistent')).toEqual([]);
  });

  it('delete removes all versions for an execution', async () => {
    const store = new InMemoryCheckpointStore();

    await store.save(createTestState({ checkpointVersion: 0 }));
    await store.save(createTestState({ checkpointVersion: 1 }));
    expect(store.size).toBe(1);
    expect(store.versionCount('exec-1')).toBe(2);

    await store.delete('exec-1');
    expect(store.size).toBe(0);
    expect(await store.load('exec-1')).toBeNull();
  });

  it('prune keeps only the last N versions', async () => {
    const store = new InMemoryCheckpointStore();

    await store.save(createTestState({ checkpointVersion: 0 }));
    await store.save(createTestState({ checkpointVersion: 1 }));
    await store.save(createTestState({ checkpointVersion: 2 }));
    await store.save(createTestState({ checkpointVersion: 3 }));

    const pruned = await store.prune('exec-1', 2);
    expect(pruned).toBe(2);
    expect(store.versionCount('exec-1')).toBe(2);

    // Should keep versions 3 and 2
    expect(await store.loadVersion('exec-1', 3)).not.toBeNull();
    expect(await store.loadVersion('exec-1', 2)).not.toBeNull();
    expect(await store.loadVersion('exec-1', 1)).toBeNull();
    expect(await store.loadVersion('exec-1', 0)).toBeNull();
  });

  it('prune returns 0 when nothing to prune', async () => {
    const store = new InMemoryCheckpointStore();
    await store.save(createTestState({ checkpointVersion: 0 }));
    expect(await store.prune('exec-1', 5)).toBe(0);
  });

  it('clear removes everything', async () => {
    const store = new InMemoryCheckpointStore();
    await store.save(createTestState({ executionId: 'e1', checkpointVersion: 0 }));
    await store.save(createTestState({ executionId: 'e2', checkpointVersion: 0 }));
    expect(store.size).toBe(2);

    store.clear();
    expect(store.size).toBe(0);
  });
});

// ── recoverState Tests ──────────────────────────────────────────

describe('recoverState', () => {
  it('resets running nodes to pending', () => {
    const state = createTestState();
    state.nodeStates['node-b'] = {
      ...state.nodeStates['node-b']!,
      status: 'running',
      startedAt: '2026-01-01T00:00:02Z',
    };

    const recovered = recoverState(state);
    expect(recovered.nodeStates['node-b']!.status).toBe('pending');
    expect(recovered.nodeStates['node-b']!.startedAt).toBeNull();
    expect(recovered.status).toBe('running');
  });

  it('resets queued nodes to pending', () => {
    const state = createTestState();
    state.nodeStates['node-b'] = { ...state.nodeStates['node-b']!, status: 'queued' };

    const recovered = recoverState(state);
    expect(recovered.nodeStates['node-b']!.status).toBe('pending');
  });

  it('resets retrying nodes to pending', () => {
    const state = createTestState();
    state.nodeStates['node-b'] = { ...state.nodeStates['node-b']!, status: 'retrying' };

    const recovered = recoverState(state);
    expect(recovered.nodeStates['node-b']!.status).toBe('pending');
  });

  it('leaves completed and failed nodes unchanged', () => {
    const state = createTestState();
    state.nodeStates['node-a']!.status = 'completed';
    state.nodeStates['node-b']!.status = 'failed';

    const recovered = recoverState(state);
    expect(recovered.nodeStates['node-a']!.status).toBe('completed');
    expect(recovered.nodeStates['node-b']!.status).toBe('failed');
  });

  it('does not mutate original state', () => {
    const state = createTestState();
    state.nodeStates['node-b'] = { ...state.nodeStates['node-b']!, status: 'running' };

    recoverState(state);
    expect(state.nodeStates['node-b']!.status).toBe('running');
  });
});

// ── Serialization Tests ─────────────────────────────────────────

describe('serializeState / deserializeState', () => {
  it('round-trips a valid state', () => {
    const state = createTestState();
    const json = serializeState(state);
    const deserialized = deserializeState(json);

    expect(deserialized.executionId).toBe(state.executionId);
    expect(deserialized.workflowId).toBe(state.workflowId);
    expect(deserialized.checkpointVersion).toBe(state.checkpointVersion);
  });

  it('throws on invalid JSON', () => {
    expect(() => deserializeState('not json')).toThrow();
  });

  it('throws on missing executionId', () => {
    expect(() => deserializeState(JSON.stringify({ workflowId: 'x', nodeStates: {}, checkpointVersion: 0 }))).toThrow('missing executionId');
  });

  it('throws on missing workflowId', () => {
    expect(() => deserializeState(JSON.stringify({ executionId: 'x', nodeStates: {}, checkpointVersion: 0 }))).toThrow('missing workflowId');
  });

  it('throws on missing nodeStates', () => {
    expect(() => deserializeState(JSON.stringify({ executionId: 'x', workflowId: 'y', checkpointVersion: 0 }))).toThrow('missing nodeStates');
  });

  it('throws on missing checkpointVersion', () => {
    expect(() => deserializeState(JSON.stringify({ executionId: 'x', workflowId: 'y', nodeStates: {} }))).toThrow('missing checkpointVersion');
  });

  it('throws on non-object input', () => {
    expect(() => deserializeState('"just a string"')).toThrow('expected an object');
  });
});
