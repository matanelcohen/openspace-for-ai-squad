/**
 * Dependency Resolution, Cycle Detection & Re-queuing Tests
 *
 * Covers:
 * 1. Dependency checker: task blocked when dependencies not done, unblocked when all done
 * 2. Circular dependency detection: A→B→C→A rejected
 * 3. Re-queuing: pending tasks re-evaluated after dependencies complete
 * 4. Auto-dependency setting during delegation via DAGBuilder sequential edges
 */

import { describe, expect, it, vi } from 'vitest';

import type {
  DAGWorkflow,
  DAGWorkflowEngineConfig,
  EnhancedNodeExecutionState,
  EnhancedWorkflowExecutionState,
  ExecutionContext,
  StepNode,
  ToolRegistryRef,
} from '../types/dag-workflow.js';
import { InMemoryCheckpointStore } from '../workflow/checkpoint.js';
import { DAGBuilder, DAGBuilderError } from '../workflow/dag-builder.js';
import {
  DAGWorkflowEngine,
  getDAGReadyNodes,
  hasDAGCycle,
  topologicalLevels,
  validateDAGWorkflow,
} from '../workflow/dag-engine.js';

// ── Helpers ─────────────────────────────────────────────────────

function makeNode(id: string, type: StepNode['type'] = 'task'): StepNode {
  return { id, label: id.toUpperCase(), type, config: {} };
}

function makeNodes(...ids: string[]): StepNode[] {
  return ids.map((id) => makeNode(id));
}

function makePendingState(workflow: DAGWorkflow): EnhancedWorkflowExecutionState {
  const nodeStates: Record<string, EnhancedNodeExecutionState> = {};
  for (const node of workflow.nodes) {
    nodeStates[node.id] = {
      nodeId: node.id,
      status: 'pending',
      startedAt: null,
      completedAt: null,
      output: null,
      error: null,
      escalationId: null,
      attempt: 0,
      attempts: [],
      durationMs: null,
    };
  }

  return {
    executionId: 'test-exec',
    workflowId: workflow.id,
    workflowVersion: workflow.version,
    status: 'running',
    nodeStates,
    contextSnapshot: { vars: {}, nodeOutputs: {}, startedAt: '', traceId: '' },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    checkpointVersion: 0,
    activeInterrupts: [],
  };
}

function completeNode(
  state: EnhancedWorkflowExecutionState,
  nodeId: string,
): EnhancedWorkflowExecutionState {
  return {
    ...state,
    nodeStates: {
      ...state.nodeStates,
      [nodeId]: {
        ...state.nodeStates[nodeId]!,
        status: 'completed',
        completedAt: new Date().toISOString(),
      },
    },
  };
}

function skipNode(
  state: EnhancedWorkflowExecutionState,
  nodeId: string,
): EnhancedWorkflowExecutionState {
  return {
    ...state,
    nodeStates: {
      ...state.nodeStates,
      [nodeId]: {
        ...state.nodeStates[nodeId]!,
        status: 'skipped',
        completedAt: new Date().toISOString(),
      },
    },
  };
}

function mockToolRegistry(): ToolRegistryRef {
  return {
    invoke: vi.fn().mockResolvedValue({ success: true, data: {}, durationMs: 1 }),
    discover: vi.fn().mockReturnValue([]),
  };
}

function createEngineConfig(overrides?: Partial<DAGWorkflowEngineConfig>): DAGWorkflowEngineConfig {
  return {
    checkpointStore: new InMemoryCheckpointStore(),
    toolRegistry: mockToolRegistry(),
    handlers: {
      echo: async (_node: StepNode, ctx: ExecutionContext) => ({
        echo: true,
        vars: ctx.vars,
      }),
    },
    onHITLGate: vi.fn().mockResolvedValue('esc-1'),
    resolveEscalation: vi.fn().mockResolvedValue({ approved: true }),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// 1. Dependency Checker — blocked vs. unblocked
// ═══════════════════════════════════════════════════════════════

describe('Dependency checker (getDAGReadyNodes)', () => {
  it('blocks a task when dependency A is not done', () => {
    const workflow: DAGWorkflow = {
      id: 'dep-check',
      name: 'Dep Check',
      version: '1.0.0',
      nodes: [
        makeNode('start', 'start'),
        makeNode('A'),
        makeNode('target'),
        makeNode('end', 'end'),
      ],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'A', to: 'target' },
        { from: 'target', to: 'end' },
      ],
    };

    let state = makePendingState(workflow);
    state = completeNode(state, 'start');

    const ready = getDAGReadyNodes(workflow, state);
    const readyIds = ready.map((n) => n.id);

    expect(readyIds).toContain('A');
    expect(readyIds).not.toContain('target');
  });

  it('blocks a task when depends_on=[A, B] and only A is done', () => {
    const workflow: DAGWorkflow = {
      id: 'dep-multi',
      name: 'Multi Dep',
      version: '1.0.0',
      nodes: [
        makeNode('start', 'start'),
        makeNode('A'),
        makeNode('B'),
        makeNode('target'),
        makeNode('end', 'end'),
      ],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'start', to: 'B' },
        { from: 'A', to: 'target' },
        { from: 'B', to: 'target' },
        { from: 'target', to: 'end' },
      ],
    };

    let state = makePendingState(workflow);
    state = completeNode(state, 'start');
    state = completeNode(state, 'A');

    const ready = getDAGReadyNodes(workflow, state);
    const readyIds = ready.map((n) => n.id);

    expect(readyIds).not.toContain('target');
    expect(readyIds).toContain('B');
  });

  it('blocks a task when depends_on=[A, B] and only B is done', () => {
    const workflow: DAGWorkflow = {
      id: 'dep-multi-b',
      name: 'Multi Dep B',
      version: '1.0.0',
      nodes: [
        makeNode('start', 'start'),
        makeNode('A'),
        makeNode('B'),
        makeNode('target'),
        makeNode('end', 'end'),
      ],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'start', to: 'B' },
        { from: 'A', to: 'target' },
        { from: 'B', to: 'target' },
        { from: 'target', to: 'end' },
      ],
    };

    let state = makePendingState(workflow);
    state = completeNode(state, 'start');
    state = completeNode(state, 'B');

    const ready = getDAGReadyNodes(workflow, state);
    const readyIds = ready.map((n) => n.id);

    expect(readyIds).not.toContain('target');
    expect(readyIds).toContain('A');
  });

  it('unblocks a task when both A and B are done', () => {
    const workflow: DAGWorkflow = {
      id: 'dep-unblock',
      name: 'Unblock',
      version: '1.0.0',
      nodes: [
        makeNode('start', 'start'),
        makeNode('A'),
        makeNode('B'),
        makeNode('target'),
        makeNode('end', 'end'),
      ],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'start', to: 'B' },
        { from: 'A', to: 'target' },
        { from: 'B', to: 'target' },
        { from: 'target', to: 'end' },
      ],
    };

    let state = makePendingState(workflow);
    state = completeNode(state, 'start');
    state = completeNode(state, 'A');
    state = completeNode(state, 'B');

    const ready = getDAGReadyNodes(workflow, state);
    const readyIds = ready.map((n) => n.id);

    expect(readyIds).toContain('target');
  });

  it('treats skipped dependencies as terminal (unblocks downstream)', () => {
    const workflow: DAGWorkflow = {
      id: 'dep-skip',
      name: 'Skipped Dep',
      version: '1.0.0',
      nodes: [
        makeNode('start', 'start'),
        makeNode('A'),
        makeNode('B'),
        makeNode('target'),
        makeNode('end', 'end'),
      ],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'start', to: 'B' },
        { from: 'A', to: 'target' },
        { from: 'B', to: 'target' },
        { from: 'target', to: 'end' },
      ],
    };

    let state = makePendingState(workflow);
    state = completeNode(state, 'start');
    state = completeNode(state, 'A');
    state = skipNode(state, 'B');

    const ready = getDAGReadyNodes(workflow, state);
    expect(ready.map((n) => n.id)).toContain('target');
  });

  it('does not mark already-completed nodes as ready', () => {
    const workflow: DAGWorkflow = {
      id: 'no-rerun',
      name: 'No Rerun',
      version: '1.0.0',
      nodes: [makeNode('start', 'start'), makeNode('A'), makeNode('end', 'end')],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'A', to: 'end' },
      ],
    };

    let state = makePendingState(workflow);
    state = completeNode(state, 'start');
    state = completeNode(state, 'A');

    const ready = getDAGReadyNodes(workflow, state);
    expect(ready.map((n) => n.id)).not.toContain('A');
  });

  it('returns root nodes with no dependencies as immediately ready', () => {
    const workflow: DAGWorkflow = {
      id: 'roots',
      name: 'Roots',
      version: '1.0.0',
      nodes: [makeNode('start', 'start'), makeNode('A'), makeNode('B'), makeNode('end', 'end')],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'start', to: 'B' },
        { from: 'A', to: 'end' },
        { from: 'B', to: 'end' },
      ],
    };

    const state = makePendingState(workflow);
    const ready = getDAGReadyNodes(workflow, state);

    expect(ready.map((n) => n.id)).toContain('start');
    expect(ready.map((n) => n.id)).not.toContain('A');
    expect(ready.map((n) => n.id)).not.toContain('B');
  });

  it('handles a node with 3+ dependencies — all must be terminal', () => {
    const workflow: DAGWorkflow = {
      id: 'triple-dep',
      name: 'Triple',
      version: '1.0.0',
      nodes: [
        makeNode('start', 'start'),
        makeNode('A'),
        makeNode('B'),
        makeNode('C'),
        makeNode('target'),
        makeNode('end', 'end'),
      ],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'start', to: 'B' },
        { from: 'start', to: 'C' },
        { from: 'A', to: 'target' },
        { from: 'B', to: 'target' },
        { from: 'C', to: 'target' },
        { from: 'target', to: 'end' },
      ],
    };

    let state = makePendingState(workflow);
    state = completeNode(state, 'start');
    state = completeNode(state, 'A');
    state = completeNode(state, 'B');

    expect(getDAGReadyNodes(workflow, state).map((n) => n.id)).not.toContain('target');

    state = completeNode(state, 'C');
    expect(getDAGReadyNodes(workflow, state).map((n) => n.id)).toContain('target');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. Circular Dependency Detection
// ═══════════════════════════════════════════════════════════════

describe('Circular dependency detection', () => {
  it('rejects A→B→C→A cycle', () => {
    const nodes = makeNodes('A', 'B', 'C');
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'A' },
    ];
    expect(hasDAGCycle(nodes, edges)).toBe(true);
  });

  it('rejects direct A→B→A cycle', () => {
    const nodes = makeNodes('A', 'B');
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'A' },
    ];
    expect(hasDAGCycle(nodes, edges)).toBe(true);
  });

  it('rejects self-loop A→A', () => {
    const nodes = makeNodes('A');
    const edges = [{ from: 'A', to: 'A' }];
    expect(hasDAGCycle(nodes, edges)).toBe(true);
  });

  it('rejects long cycle A→B→C→D→E→A', () => {
    const nodes = makeNodes('A', 'B', 'C', 'D', 'E');
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
      { from: 'C', to: 'D' },
      { from: 'D', to: 'E' },
      { from: 'E', to: 'A' },
    ];
    expect(hasDAGCycle(nodes, edges)).toBe(true);
  });

  it('rejects cycle in subgraph even when other nodes are acyclic', () => {
    const nodes = makeNodes('A', 'B', 'C', 'D');
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'C', to: 'D' },
      { from: 'D', to: 'C' },
    ];
    expect(hasDAGCycle(nodes, edges)).toBe(true);
  });

  it('accepts valid acyclic graph A→B→C', () => {
    const nodes = makeNodes('A', 'B', 'C');
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'B', to: 'C' },
    ];
    expect(hasDAGCycle(nodes, edges)).toBe(false);
  });

  it('accepts diamond pattern (no cycle)', () => {
    const nodes = makeNodes('A', 'B', 'C', 'D');
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'A', to: 'C' },
      { from: 'B', to: 'D' },
      { from: 'C', to: 'D' },
    ];
    expect(hasDAGCycle(nodes, edges)).toBe(false);
  });

  it('accepts disconnected acyclic components', () => {
    const nodes = makeNodes('A', 'B', 'C', 'D');
    const edges = [
      { from: 'A', to: 'B' },
      { from: 'C', to: 'D' },
    ];
    expect(hasDAGCycle(nodes, edges)).toBe(false);
  });

  it('validateDAGWorkflow reports cycle error in workflow definition', () => {
    const workflow: DAGWorkflow = {
      id: 'cyclic',
      name: 'Cyclic',
      version: '1.0.0',
      nodes: [
        makeNode('start', 'start'),
        makeNode('A'),
        makeNode('B'),
        makeNode('C'),
        makeNode('end', 'end'),
      ],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
        { from: 'C', to: 'end' },
      ],
    };

    const errors = validateDAGWorkflow(workflow);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.toLowerCase().includes('cycle'))).toBe(true);
  });

  it('DAGBuilder.wouldCycle detects potential cycles before adding edges', () => {
    const builder = new DAGBuilder('wf', 'Workflow');
    builder
      .addStep({ id: 'A', label: 'A', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'B', label: 'B', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'C', label: 'C', type: 'task', config: { handler: 'echo' } })
      .addEdge('A', 'B')
      .addEdge('B', 'C');

    expect(builder.wouldCycle('C', 'A')).toBe(true);
    expect(builder.wouldCycle('A', 'C')).toBe(false);
  });

  it('DAGBuilder.build() throws for cyclic workflows', () => {
    const builder = new DAGBuilder('wf', 'Workflow', { manualSentinels: true });
    builder
      .addStep({ id: 'start', label: 'Start', type: 'start', config: {} })
      .addStep({ id: 'A', label: 'A', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'B', label: 'B', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'C', label: 'C', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'end', label: 'End', type: 'end', config: {} })
      .addEdge('start', 'A')
      .addEdge('A', 'B')
      .addEdge('B', 'C')
      .addEdge('C', 'A')
      .addEdge('C', 'end');

    expect(() => builder.build()).toThrow(DAGBuilderError);
  });

  it('DAGWorkflowEngine.start() rejects cyclic workflow definitions', async () => {
    const engine = new DAGWorkflowEngine(createEngineConfig());
    const workflow: DAGWorkflow = {
      id: 'cyclic-engine',
      name: 'Cyclic Engine',
      version: '1.0.0',
      nodes: [
        makeNode('start', 'start'),
        makeNode('A'),
        makeNode('B'),
        makeNode('C'),
        makeNode('end', 'end'),
      ],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'A', to: 'B' },
        { from: 'B', to: 'C' },
        { from: 'C', to: 'A' },
        { from: 'C', to: 'end' },
      ],
    };

    await expect(engine.start(workflow)).rejects.toThrow('Invalid workflow');
  });
});

// ═══════════════════════════════════════════════════════════════
// 3. Re-queuing — tasks retried after dependencies complete
// ═══════════════════════════════════════════════════════════════

describe('Re-queuing (pending tasks re-evaluated each loop iteration)', () => {
  it('pending node becomes ready after dependencies complete in subsequent iterations', () => {
    const workflow: DAGWorkflow = {
      id: 'requeue',
      name: 'Requeue',
      version: '1.0.0',
      nodes: [
        makeNode('start', 'start'),
        makeNode('A'),
        makeNode('target'),
        makeNode('end', 'end'),
      ],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'A', to: 'target' },
        { from: 'target', to: 'end' },
      ],
    };

    let state = makePendingState(workflow);

    // Iteration 1: only start is ready
    let ready = getDAGReadyNodes(workflow, state);
    expect(ready.map((n) => n.id)).toEqual(['start']);
    expect(ready.map((n) => n.id)).not.toContain('target');

    // Complete start
    state = completeNode(state, 'start');

    // Iteration 2: A is now ready, target still blocked
    ready = getDAGReadyNodes(workflow, state);
    expect(ready.map((n) => n.id)).toContain('A');
    expect(ready.map((n) => n.id)).not.toContain('target');

    // Complete A
    state = completeNode(state, 'A');

    // Iteration 3: target is now "re-queued" — it becomes ready
    ready = getDAGReadyNodes(workflow, state);
    expect(ready.map((n) => n.id)).toContain('target');
  });

  it('multi-dependency re-queue: target blocked until all deps complete across iterations', () => {
    const workflow: DAGWorkflow = {
      id: 'multi-requeue',
      name: 'Multi Requeue',
      version: '1.0.0',
      nodes: [
        makeNode('start', 'start'),
        makeNode('A'),
        makeNode('B'),
        makeNode('target'),
        makeNode('end', 'end'),
      ],
      edges: [
        { from: 'start', to: 'A' },
        { from: 'start', to: 'B' },
        { from: 'A', to: 'target' },
        { from: 'B', to: 'target' },
        { from: 'target', to: 'end' },
      ],
    };

    let state = makePendingState(workflow);
    state = completeNode(state, 'start');

    state = completeNode(state, 'A');
    let ready = getDAGReadyNodes(workflow, state);
    expect(ready.map((n) => n.id)).not.toContain('target');

    state = completeNode(state, 'B');
    ready = getDAGReadyNodes(workflow, state);
    expect(ready.map((n) => n.id)).toContain('target');
  });

  it('engine run loop automatically re-evaluates pending tasks', async () => {
    const executionOrder: string[] = [];
    const config = createEngineConfig({
      handlers: {
        echo: async (node: StepNode) => {
          executionOrder.push(node.id);
          return { done: true };
        },
      },
    });

    const engine = new DAGWorkflowEngine(config);
    const workflow = new DAGBuilder('requeue-engine', 'Requeue Engine')
      .addStep({ id: 'A', label: 'A', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'B', label: 'B', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'C', label: 'C', type: 'task', config: { handler: 'echo' } })
      .addEdge('A', 'B')
      .addEdge('B', 'C')
      .build();

    const result = await engine.start(workflow);

    expect(result.status).toBe('completed');
    expect(executionOrder.indexOf('A')).toBeLessThan(executionOrder.indexOf('B'));
    expect(executionOrder.indexOf('B')).toBeLessThan(executionOrder.indexOf('C'));
  });

  it('parallel branches do not block each other but join node waits for all', async () => {
    const executionOrder: string[] = [];
    const config = createEngineConfig({
      handlers: {
        echo: async (node: StepNode) => {
          executionOrder.push(node.id);
          return { done: true };
        },
      },
    });

    const engine = new DAGWorkflowEngine(config);
    const workflow = new DAGBuilder('parallel-join', 'Parallel Join')
      .addStep({ id: 'root', label: 'Root', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'branch-A', label: 'Branch A', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'branch-B', label: 'Branch B', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'join', label: 'Join', type: 'task', config: { handler: 'echo' } })
      .addEdge('root', 'branch-A')
      .addEdge('root', 'branch-B')
      .addEdge('branch-A', 'join')
      .addEdge('branch-B', 'join')
      .build();

    const result = await engine.start(workflow);

    expect(result.status).toBe('completed');
    expect(executionOrder.indexOf('root')).toBeLessThan(executionOrder.indexOf('branch-A'));
    expect(executionOrder.indexOf('root')).toBeLessThan(executionOrder.indexOf('branch-B'));
    expect(executionOrder.indexOf('branch-A')).toBeLessThan(executionOrder.indexOf('join'));
    expect(executionOrder.indexOf('branch-B')).toBeLessThan(executionOrder.indexOf('join'));
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. Auto-dependency setting during delegation (DAGBuilder)
// ═══════════════════════════════════════════════════════════════

describe('Auto-dependency via sequential DAGBuilder edges', () => {
  it('sequential workflow hints: edges create correct depends_on ordering', () => {
    const builder = new DAGBuilder('delegation', 'Delegated Tasks');
    builder
      .addStep({ id: 'schema', label: 'Define schema', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'routes', label: 'Build routes', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'tests', label: 'Write tests', type: 'task', config: { handler: 'echo' } })
      .addEdge('schema', 'routes')
      .addEdge('routes', 'tests');

    const workflow = builder.build();

    expect(workflow.edges.some((e) => e.from === 'schema' && e.to === 'routes')).toBe(true);
    expect(workflow.edges.some((e) => e.from === 'routes' && e.to === 'tests')).toBe(true);
    expect(workflow.edges.some((e) => e.from === '__start__' && e.to === 'schema')).toBe(true);
    expect(workflow.edges.some((e) => e.from === 'tests' && e.to === '__end__')).toBe(true);

    const levels = topologicalLevels(workflow.nodes, workflow.edges);
    const schemaLevel = levels.findIndex((l) => l.includes('schema'));
    const routesLevel = levels.findIndex((l) => l.includes('routes'));
    const testsLevel = levels.findIndex((l) => l.includes('tests'));

    expect(schemaLevel).toBeLessThan(routesLevel);
    expect(routesLevel).toBeLessThan(testsLevel);
  });

  it('mixed parallel+sequential delegation creates correct dependency graph', () => {
    const builder = new DAGBuilder('mixed-delegation', 'Mixed');
    builder
      .addStep({ id: 'schema', label: 'Schema', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'routes', label: 'Routes', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'tests', label: 'Tests', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'deploy', label: 'Deploy', type: 'task', config: { handler: 'echo' } })
      .addEdge('schema', 'routes')
      .addEdge('schema', 'tests')
      .addEdge('routes', 'deploy')
      .addEdge('tests', 'deploy');

    const workflow = builder.build();
    const levels = topologicalLevels(workflow.nodes, workflow.edges);

    const routesLevel = levels.findIndex((l) => l.includes('routes'));
    const testsLevel = levels.findIndex((l) => l.includes('tests'));
    expect(routesLevel).toBe(testsLevel);

    const deployLevel = levels.findIndex((l) => l.includes('deploy'));
    expect(deployLevel).toBeGreaterThan(routesLevel);
  });

  it('validates that adding a reverse dependency would create a cycle', () => {
    const builder = new DAGBuilder('cycle-check', 'Cycle Check');
    builder
      .addStep({ id: 'schema', label: 'Schema', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'routes', label: 'Routes', type: 'task', config: { handler: 'echo' } })
      .addStep({ id: 'tests', label: 'Tests', type: 'task', config: { handler: 'echo' } })
      .addEdge('schema', 'routes')
      .addEdge('routes', 'tests');

    expect(builder.wouldCycle('tests', 'schema')).toBe(true);
    expect(builder.wouldCycle('tests', 'routes')).toBe(true);
    expect(builder.wouldCycle('schema', 'tests')).toBe(false);
  });
});
