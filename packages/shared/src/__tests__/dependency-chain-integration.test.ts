/**
 * Dependency Chain Integration Test
 *
 * Covers requirement #5: create a 3-task chain (schema→routes→tests),
 * complete them in order, verify each unblocks the next.
 *
 * Uses the full DAGWorkflowEngine with checkpoint store and event tracking
 * to verify end-to-end dependency resolution in a realistic scenario.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  DAGWorkflowEngineConfig,
  ExecutionContext,
  StepNode,
  ToolRegistryRef,
  WorkflowEventPayload,
} from '../types/dag-workflow.js';
import { InMemoryCheckpointStore } from '../workflow/checkpoint.js';
import { DAGBuilder } from '../workflow/dag-builder.js';
import { DAGWorkflowEngine, topologicalLevels } from '../workflow/dag-engine.js';

// ── Test Helpers ────────────────────────────────────────────────

function mockToolRegistry(): ToolRegistryRef {
  return {
    invoke: vi.fn().mockResolvedValue({ success: true, data: {}, durationMs: 1 }),
    discover: vi.fn().mockReturnValue([]),
  };
}

function createConfig(overrides?: Partial<DAGWorkflowEngineConfig>): DAGWorkflowEngineConfig {
  return {
    checkpointStore: new InMemoryCheckpointStore(),
    toolRegistry: mockToolRegistry(),
    handlers: {
      echo: async (_node: StepNode, ctx: ExecutionContext) => ({
        result: 'ok',
        vars: ctx.vars,
      }),
    },
    onHITLGate: vi.fn().mockResolvedValue('esc-1'),
    resolveEscalation: vi.fn().mockResolvedValue({ approved: true }),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// Integration: 3-Task Chain (schema → routes → tests)
// ═══════════════════════════════════════════════════════════════

describe('3-task dependency chain integration (schema → routes → tests)', () => {
  let executionOrder: string[];
  let events: WorkflowEventPayload[];
  let engine: DAGWorkflowEngine;

  beforeEach(() => {
    executionOrder = [];
    events = [];

    const config = createConfig({
      handlers: {
        'create-schema': async (node: StepNode) => {
          executionOrder.push(node.id);
          return { schema: { tables: ['users', 'posts'] } };
        },
        'build-routes': async (node: StepNode, ctx: ExecutionContext) => {
          executionOrder.push(node.id);
          const schemaOutput = ctx.nodeOutputs['schema'];
          return { routes: ['/users', '/posts'], schemaAvailable: !!schemaOutput };
        },
        'write-tests': async (node: StepNode, ctx: ExecutionContext) => {
          executionOrder.push(node.id);
          const routesOutput = ctx.nodeOutputs['routes'];
          return { tests: 5, routesAvailable: !!routesOutput };
        },
      },
      eventListeners: [(payload) => events.push(payload)],
    });

    engine = new DAGWorkflowEngine(config);
  });

  function buildChainWorkflow() {
    return new DAGBuilder('dev-chain', 'Development Chain', {
      description: 'schema → routes → tests sequential dependency chain',
    })
      .addStep({
        id: 'schema',
        label: 'Define Database Schema',
        type: 'task',
        config: { handler: 'create-schema' },
      })
      .addStep({
        id: 'routes',
        label: 'Build API Routes',
        type: 'task',
        config: { handler: 'build-routes' },
      })
      .addStep({
        id: 'tests',
        label: 'Write Tests',
        type: 'task',
        config: { handler: 'write-tests' },
      })
      .addEdge('schema', 'routes')
      .addEdge('routes', 'tests')
      .build();
  }

  it('completes all 3 tasks in sequential order', async () => {
    const workflow = buildChainWorkflow();
    const result = await engine.start(workflow);

    expect(result.status).toBe('completed');
    expect(result.nodeStates['schema']!.status).toBe('completed');
    expect(result.nodeStates['routes']!.status).toBe('completed');
    expect(result.nodeStates['tests']!.status).toBe('completed');
  });

  it('executes tasks in correct dependency order: schema → routes → tests', async () => {
    const workflow = buildChainWorkflow();
    await engine.start(workflow);

    const schemaIdx = executionOrder.indexOf('schema');
    const routesIdx = executionOrder.indexOf('routes');
    const testsIdx = executionOrder.indexOf('tests');

    expect(schemaIdx).toBeGreaterThanOrEqual(0);
    expect(routesIdx).toBeGreaterThan(schemaIdx);
    expect(testsIdx).toBeGreaterThan(routesIdx);
  });

  it('each node unblocks the next — routes only starts after schema completes', async () => {
    const workflow = buildChainWorkflow();
    const result = await engine.start(workflow);

    const schemaCompleted = result.nodeStates['schema']!.completedAt!;
    const routesStarted = result.nodeStates['routes']!.startedAt!;
    expect(new Date(routesStarted).getTime()).toBeGreaterThanOrEqual(
      new Date(schemaCompleted).getTime(),
    );

    const routesCompleted = result.nodeStates['routes']!.completedAt!;
    const testsStarted = result.nodeStates['tests']!.startedAt!;
    expect(new Date(testsStarted).getTime()).toBeGreaterThanOrEqual(
      new Date(routesCompleted).getTime(),
    );
  });

  it('context carries outputs from completed nodes to downstream handlers', async () => {
    const workflow = buildChainWorkflow();
    const result = await engine.start(workflow);

    const routesOutput = result.nodeStates['routes']!.output as Record<string, unknown>;
    expect(routesOutput.schemaAvailable).toBe(true);

    const testsOutput = result.nodeStates['tests']!.output as Record<string, unknown>;
    expect(testsOutput.routesAvailable).toBe(true);
  });

  it('emits events in correct order: node:started/completed for each task', async () => {
    const workflow = buildChainWorkflow();
    await engine.start(workflow);

    const nodeEvents = events
      .filter((e) => e.event.startsWith('node:') && e.nodeId)
      .map((e) => ({ event: e.event, nodeId: e.nodeId }));

    for (const nodeId of ['schema', 'routes', 'tests']) {
      const started = nodeEvents.findIndex(
        (e) => e.event === 'node:started' && e.nodeId === nodeId,
      );
      const completed = nodeEvents.findIndex(
        (e) => e.event === 'node:completed' && e.nodeId === nodeId,
      );
      expect(started).toBeGreaterThanOrEqual(0);
      expect(completed).toBeGreaterThan(started);
    }

    const schemaCompleted = nodeEvents.findIndex(
      (e) => e.event === 'node:completed' && e.nodeId === 'schema',
    );
    const routesStarted = nodeEvents.findIndex(
      (e) => e.event === 'node:started' && e.nodeId === 'routes',
    );
    expect(schemaCompleted).toBeLessThan(routesStarted);

    const routesCompleted = nodeEvents.findIndex(
      (e) => e.event === 'node:completed' && e.nodeId === 'routes',
    );
    const testsStarted = nodeEvents.findIndex(
      (e) => e.event === 'node:started' && e.nodeId === 'tests',
    );
    expect(routesCompleted).toBeLessThan(testsStarted);
  });

  it('topological levels reflect the 3-step chain ordering', () => {
    const workflow = buildChainWorkflow();
    const levels = topologicalLevels(workflow.nodes, workflow.edges);

    const schemaLevel = levels.findIndex((l) => l.includes('schema'));
    const routesLevel = levels.findIndex((l) => l.includes('routes'));
    const testsLevel = levels.findIndex((l) => l.includes('tests'));

    expect(schemaLevel).toBeLessThan(routesLevel);
    expect(routesLevel).toBeLessThan(testsLevel);
  });

  it('checkpoint captures state after each dependency chain step', async () => {
    const store = new InMemoryCheckpointStore();
    const config = createConfig({
      checkpointStore: store,
      handlers: {
        'create-schema': async () => ({ schema: true }),
        'build-routes': async () => ({ routes: true }),
        'write-tests': async () => ({ tests: true }),
      },
    });
    const eng = new DAGWorkflowEngine(config);

    const workflow = buildChainWorkflow();
    const result = await eng.start(workflow);

    const loaded = await store.load(result.executionId);
    expect(loaded).not.toBeNull();
    expect(loaded!.status).toBe('completed');
    expect(loaded!.checkpointVersion).toBeGreaterThan(0);
  });

  it('failure in middle of chain stops execution (routes fails → tests never runs)', async () => {
    const config = createConfig({
      handlers: {
        'create-schema': async (node: StepNode) => {
          executionOrder.push(node.id);
          return { schema: true };
        },
        'build-routes': async () => {
          throw new Error('Route generation failed');
        },
        'write-tests': async (node: StepNode) => {
          executionOrder.push(node.id);
          return { tests: true };
        },
      },
    });
    const eng = new DAGWorkflowEngine(config);

    const workflow = new DAGBuilder('fail-chain', 'Fail Chain')
      .addStep({
        id: 'schema',
        label: 'Schema',
        type: 'task',
        config: { handler: 'create-schema' },
        onFailure: 'fail_workflow',
      })
      .addStep({
        id: 'routes',
        label: 'Routes',
        type: 'task',
        config: { handler: 'build-routes' },
        onFailure: 'fail_workflow',
      })
      .addStep({
        id: 'tests',
        label: 'Tests',
        type: 'task',
        config: { handler: 'write-tests' },
      })
      .addEdge('schema', 'routes')
      .addEdge('routes', 'tests')
      .build();

    const result = await eng.start(workflow);

    expect(result.status).toBe('failed');
    expect(result.nodeStates['schema']!.status).toBe('completed');
    expect(result.nodeStates['routes']!.status).toBe('failed');
    expect(executionOrder).not.toContain('tests');
  });

  it('skip in middle of chain allows downstream to continue', async () => {
    const config = createConfig({
      handlers: {
        'create-schema': async () => ({ schema: true }),
        'build-routes': async () => {
          throw new Error('Routes skippable failure');
        },
        'write-tests': async () => ({ tests: true }),
      },
    });
    const eng = new DAGWorkflowEngine(config);

    const workflow = new DAGBuilder('skip-chain', 'Skip Chain')
      .addStep({
        id: 'schema',
        label: 'Schema',
        type: 'task',
        config: { handler: 'create-schema' },
      })
      .addStep({
        id: 'routes',
        label: 'Routes',
        type: 'task',
        config: { handler: 'build-routes' },
        onFailure: 'skip',
      })
      .addStep({
        id: 'tests',
        label: 'Tests',
        type: 'task',
        config: { handler: 'write-tests' },
      })
      .addEdge('schema', 'routes')
      .addEdge('routes', 'tests')
      .build();

    const result = await eng.start(workflow);

    expect(result.status).toBe('completed');
    expect(result.nodeStates['schema']!.status).toBe('completed');
    expect(result.nodeStates['routes']!.status).toBe('skipped');
    expect(result.nodeStates['tests']!.status).toBe('completed');
  });
});
