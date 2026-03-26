import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  DAGWorkflowEngine,
  getDAGReadyNodes,
  hasDAGCycle,
  topologicalLevels,
  validateDAGWorkflow,
} from '../workflow/dag-engine.js';
import { DAGBuilder } from '../workflow/dag-builder.js';
import { InMemoryCheckpointStore } from '../workflow/checkpoint.js';
import type {
  DAGWorkflow,
  DAGWorkflowEngineConfig,
  EnhancedWorkflowExecutionState,
  ExecutionContext,
  StepNode,
  ToolRegistryRef,
  WorkflowEventPayload,
} from '../types/dag-workflow.js';

// ── Test Helpers ────────────────────────────────────────────────

function createMockToolRegistry(): ToolRegistryRef {
  return {
    invoke: vi.fn().mockResolvedValue({ success: true, data: { result: 'ok' }, durationMs: 10 }),
    discover: vi.fn().mockReturnValue([]),
  };
}

function createEngineConfig(overrides?: Partial<DAGWorkflowEngineConfig>): DAGWorkflowEngineConfig {
  return {
    checkpointStore: new InMemoryCheckpointStore(),
    toolRegistry: createMockToolRegistry(),
    handlers: {
      echo: async (_node: StepNode, ctx: ExecutionContext) => ({ echo: true, vars: ctx.vars }),
      slow: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return { slow: true };
      },
      fail: async () => {
        throw new Error('Intentional failure');
      },
    },
    onHITLGate: vi.fn().mockResolvedValue('esc-123'),
    resolveEscalation: vi.fn().mockResolvedValue({ approved: true }),
    ...overrides,
  };
}

function buildLinearWorkflow(): DAGWorkflow {
  return new DAGBuilder('linear', 'Linear')
    .addStep({ id: 'a', label: 'A', type: 'task', config: { handler: 'echo' } })
    .addStep({ id: 'b', label: 'B', type: 'task', config: { handler: 'echo' } })
    .addEdge('a', 'b')
    .build();
}

function buildParallelWorkflow(): DAGWorkflow {
  return new DAGBuilder('parallel', 'Parallel')
    .addStep({ id: 'fetch', label: 'Fetch', type: 'task', config: { handler: 'echo' } })
    .addStep({ id: 'lint', label: 'Lint', type: 'task', config: { handler: 'echo' } })
    .addStep({ id: 'test', label: 'Test', type: 'task', config: { handler: 'echo' } })
    .addStep({ id: 'deploy', label: 'Deploy', type: 'task', config: { handler: 'echo' } })
    .addEdge('fetch', 'lint')
    .addEdge('fetch', 'test')
    .addEdge('lint', 'deploy')
    .addEdge('test', 'deploy')
    .build();
}

// ── Graph Utility Tests ─────────────────────────────────────────

describe('hasDAGCycle', () => {
  it('returns false for an acyclic graph', () => {
    const nodes: StepNode[] = [
      { id: 'a', label: 'A', type: 'task', config: {} },
      { id: 'b', label: 'B', type: 'task', config: {} },
    ];
    expect(hasDAGCycle(nodes, [{ from: 'a', to: 'b' }])).toBe(false);
  });

  it('returns true for a direct cycle', () => {
    const nodes: StepNode[] = [
      { id: 'a', label: 'A', type: 'task', config: {} },
      { id: 'b', label: 'B', type: 'task', config: {} },
    ];
    expect(hasDAGCycle(nodes, [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }])).toBe(true);
  });

  it('returns true for a self-loop', () => {
    const nodes: StepNode[] = [{ id: 'a', label: 'A', type: 'task', config: {} }];
    expect(hasDAGCycle(nodes, [{ from: 'a', to: 'a' }])).toBe(true);
  });

  it('returns true for an indirect cycle (a→b→c→a)', () => {
    const nodes: StepNode[] = [
      { id: 'a', label: 'A', type: 'task', config: {} },
      { id: 'b', label: 'B', type: 'task', config: {} },
      { id: 'c', label: 'C', type: 'task', config: {} },
    ];
    expect(hasDAGCycle(nodes, [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
      { from: 'c', to: 'a' },
    ])).toBe(true);
  });
});

describe('topologicalLevels', () => {
  it('returns correct levels for a linear chain', () => {
    const nodes: StepNode[] = [
      { id: 'a', label: 'A', type: 'task', config: {} },
      { id: 'b', label: 'B', type: 'task', config: {} },
      { id: 'c', label: 'C', type: 'task', config: {} },
    ];
    const levels = topologicalLevels(nodes, [
      { from: 'a', to: 'b' },
      { from: 'b', to: 'c' },
    ]);
    expect(levels).toEqual([['a'], ['b'], ['c']]);
  });

  it('groups independent nodes in the same level', () => {
    const nodes: StepNode[] = [
      { id: 'root', label: 'Root', type: 'task', config: {} },
      { id: 'a', label: 'A', type: 'task', config: {} },
      { id: 'b', label: 'B', type: 'task', config: {} },
      { id: 'join', label: 'Join', type: 'task', config: {} },
    ];
    const levels = topologicalLevels(nodes, [
      { from: 'root', to: 'a' },
      { from: 'root', to: 'b' },
      { from: 'a', to: 'join' },
      { from: 'b', to: 'join' },
    ]);
    expect(levels[0]).toEqual(['root']);
    expect(levels[1]!.sort()).toEqual(['a', 'b']);
    expect(levels[2]).toEqual(['join']);
  });
});

describe('validateDAGWorkflow', () => {
  it('returns no errors for a valid workflow', () => {
    const wf = buildLinearWorkflow();
    expect(validateDAGWorkflow(wf)).toEqual([]);
  });

  it('reports missing start node', () => {
    const wf: DAGWorkflow = {
      id: 'bad', name: 'Bad', version: '1.0.0',
      nodes: [
        { id: 'a', label: 'A', type: 'task', config: {} },
        { id: 'end', label: 'End', type: 'end', config: {} },
      ],
      edges: [{ from: 'a', to: 'end' }],
    };
    const errors = validateDAGWorkflow(wf);
    expect(errors.some((e) => e.includes('start'))).toBe(true);
  });

  it('reports missing end node', () => {
    const wf: DAGWorkflow = {
      id: 'bad', name: 'Bad', version: '1.0.0',
      nodes: [
        { id: 'start', label: 'Start', type: 'start', config: {} },
        { id: 'a', label: 'A', type: 'task', config: {} },
      ],
      edges: [{ from: 'start', to: 'a' }],
    };
    const errors = validateDAGWorkflow(wf);
    expect(errors.some((e) => e.includes('end'))).toBe(true);
  });

  it('reports duplicate node IDs', () => {
    const wf: DAGWorkflow = {
      id: 'bad', name: 'Bad', version: '1.0.0',
      nodes: [
        { id: 'start', label: 'Start', type: 'start', config: {} },
        { id: 'a', label: 'A1', type: 'task', config: {} },
        { id: 'a', label: 'A2', type: 'task', config: {} },
        { id: 'end', label: 'End', type: 'end', config: {} },
      ],
      edges: [{ from: 'start', to: 'a' }, { from: 'a', to: 'end' }],
    };
    const errors = validateDAGWorkflow(wf);
    expect(errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });
});

// ── Engine Execution Tests ──────────────────────────────────────

describe('DAGWorkflowEngine', () => {
  let config: DAGWorkflowEngineConfig;
  let engine: DAGWorkflowEngine;

  beforeEach(() => {
    config = createEngineConfig();
    engine = new DAGWorkflowEngine(config);
  });

  describe('start', () => {
    it('executes a linear workflow to completion', async () => {
      const wf = buildLinearWorkflow();
      const result = await engine.start(wf);

      expect(result.status).toBe('completed');
      expect(result.nodeStates['a']!.status).toBe('completed');
      expect(result.nodeStates['b']!.status).toBe('completed');
      expect(result.nodeStates['__start__']!.status).toBe('completed');
      expect(result.nodeStates['__end__']!.status).toBe('completed');
    });

    it('executes parallel paths concurrently', async () => {
      const wf = buildParallelWorkflow();
      const result = await engine.start(wf);

      expect(result.status).toBe('completed');
      expect(result.nodeStates['lint']!.status).toBe('completed');
      expect(result.nodeStates['test']!.status).toBe('completed');
      expect(result.nodeStates['deploy']!.status).toBe('completed');
    });

    it('propagates results through nodeOutputs in context', async () => {
      const wf = buildLinearWorkflow();
      const result = await engine.start(wf);

      // Context snapshot should have node outputs
      expect(result.contextSnapshot.nodeOutputs).toBeDefined();
      expect(result.contextSnapshot.nodeOutputs['a']).toBeDefined();
      expect(result.contextSnapshot.nodeOutputs['b']).toBeDefined();
    });

    it('increments checkpoint version after each batch', async () => {
      const wf = buildLinearWorkflow();
      const result = await engine.start(wf);

      expect(result.checkpointVersion).toBeGreaterThan(0);
    });

    it('passes vars from options to execution context', async () => {
      let capturedVars: Record<string, unknown> | null = null;
      const cfg = createEngineConfig({
        handlers: {
          echo: async (_node, ctx) => {
            capturedVars = { ...ctx.vars };
            return { ok: true };
          },
        },
      });
      const eng = new DAGWorkflowEngine(cfg);
      const wf = new DAGBuilder('w', 'W')
        .addStep({ id: 'a', label: 'A', type: 'task', config: { handler: 'echo' } })
        .build();

      await eng.start(wf, { vars: { env: 'test' } });
      expect(capturedVars).toMatchObject({ env: 'test' });
    });

    it('throws on invalid workflow', async () => {
      const wf: DAGWorkflow = {
        id: 'bad', name: 'Bad', version: '1.0.0',
        nodes: [], edges: [],
      };
      await expect(engine.start(wf)).rejects.toThrow('Invalid workflow');
    });
  });

  describe('tool registry integration', () => {
    it('invokes tool from registry when toolId is set', async () => {
      const toolRegistry = createMockToolRegistry();
      const cfg = createEngineConfig({ toolRegistry });
      const eng = new DAGWorkflowEngine(cfg);

      const wf = new DAGBuilder('tool-wf', 'Tool Workflow')
        .addStep({
          id: 'tool-step',
          label: 'Tool Step',
          type: 'task',
          config: { toolId: 'http-get', toolParams: { url: 'https://example.com' } },
        })
        .build();

      const result = await eng.start(wf);
      expect(result.status).toBe('completed');
      expect(toolRegistry.invoke).toHaveBeenCalledWith(
        expect.objectContaining({ toolId: 'http-get' }),
      );
    });
  });

  describe('failure handling', () => {
    it('fails the workflow when a node fails with fail_workflow policy', async () => {
      const cfg = createEngineConfig();
      const eng = new DAGWorkflowEngine(cfg);

      const wf = new DAGBuilder('fail-wf', 'Fail Workflow')
        .addStep({
          id: 'bad', label: 'Bad', type: 'task',
          config: { handler: 'fail' },
          onFailure: 'fail_workflow',
        })
        .build();

      const result = await eng.start(wf);
      expect(result.status).toBe('failed');
      expect(result.nodeStates['bad']!.status).toBe('failed');
      expect(result.nodeStates['bad']!.error).toContain('Intentional failure');
    });

    it('skips the node and continues when onFailure=skip', async () => {
      const cfg = createEngineConfig();
      const eng = new DAGWorkflowEngine(cfg);

      const wf = new DAGBuilder('skip-wf', 'Skip Workflow')
        .addStep({
          id: 'bad', label: 'Bad', type: 'task',
          config: { handler: 'fail' },
          onFailure: 'skip',
        })
        .addStep({ id: 'after', label: 'After', type: 'task', config: { handler: 'echo' } })
        .addEdge('bad', 'after')
        .build();

      const result = await eng.start(wf);
      expect(result.status).toBe('completed');
      expect(result.nodeStates['bad']!.status).toBe('skipped');
      expect(result.nodeStates['after']!.status).toBe('completed');
    });

    it('continues with null output when onFailure=continue', async () => {
      const cfg = createEngineConfig();
      const eng = new DAGWorkflowEngine(cfg);

      const wf = new DAGBuilder('cont-wf', 'Continue Workflow')
        .addStep({
          id: 'bad', label: 'Bad', type: 'task',
          config: { handler: 'fail' },
          onFailure: 'continue',
        })
        .build();

      const result = await eng.start(wf);
      expect(result.status).toBe('completed');
      expect(result.nodeStates['bad']!.status).toBe('completed');
      expect(result.nodeStates['bad']!.error).toContain('Intentional failure');
    });
  });

  describe('retry', () => {
    it('retries a failed node according to retries config', async () => {
      let attempts = 0;
      const cfg = createEngineConfig({
        handlers: {
          flaky: async () => {
            attempts++;
            if (attempts < 3) throw new Error('transient');
            return { ok: true };
          },
        },
      });
      const eng = new DAGWorkflowEngine(cfg);

      const wf = new DAGBuilder('retry-wf', 'Retry')
        .addStep({
          id: 'flaky', label: 'Flaky', type: 'task',
          config: { handler: 'flaky' },
          retries: 2,
          retryDelayMs: 1, // 1ms for test speed
        })
        .build();

      const result = await eng.start(wf);
      expect(result.status).toBe('completed');
      expect(result.nodeStates['flaky']!.attempts.length).toBe(3);
      expect(attempts).toBe(3);
    });
  });

  describe('conditional edges', () => {
    it('evaluates condition predicates and skips inactive branches', async () => {
      const builder = new DAGBuilder('cond-wf', 'Conditional', { manualSentinels: true });
      builder
        .addStep({ id: 'start', label: 'Start', type: 'start', config: {} })
        .addStep({ id: 'check', label: 'Check', type: 'condition', config: {} })
        .addStep({ id: 'yes-path', label: 'Yes', type: 'task', config: { handler: 'echo' } })
        .addStep({ id: 'no-path', label: 'No', type: 'task', config: { handler: 'echo' } })
        .addStep({ id: 'end', label: 'End', type: 'end', config: {} })
        .addEdge('start', 'check')
        .addConditionalEdge('check', 'yes-path', {
          type: 'comparison',
          field: 'ctx.vars.branch',
          operator: 'eq',
          value: 'yes',
        })
        .addEdge('check', 'no-path') // default edge
        .addEdge('yes-path', 'end')
        .addEdge('no-path', 'end');

      const wf = builder.build();
      const cfg = createEngineConfig();
      const eng = new DAGWorkflowEngine(cfg);

      const result = await eng.start(wf, { vars: { branch: 'yes' } });
      expect(result.status).toBe('completed');
      expect(result.nodeStates['yes-path']!.status).toBe('completed');
      expect(result.nodeStates['no-path']!.status).toBe('skipped');
    });

    it('takes default edge when no predicate matches', async () => {
      const builder = new DAGBuilder('cond-wf2', 'Conditional Default', { manualSentinels: true });
      builder
        .addStep({ id: 'start', label: 'Start', type: 'start', config: {} })
        .addStep({ id: 'check', label: 'Check', type: 'condition', config: {} })
        .addStep({ id: 'special', label: 'Special', type: 'task', config: { handler: 'echo' } })
        .addStep({ id: 'fallback', label: 'Fallback', type: 'task', config: { handler: 'echo' } })
        .addStep({ id: 'end', label: 'End', type: 'end', config: {} })
        .addEdge('start', 'check')
        .addConditionalEdge('check', 'special', {
          type: 'comparison',
          field: 'ctx.vars.mode',
          operator: 'eq',
          value: 'special',
        })
        .addEdge('check', 'fallback')
        .addEdge('special', 'end')
        .addEdge('fallback', 'end');

      const wf = builder.build();
      const eng = new DAGWorkflowEngine(createEngineConfig());

      const result = await eng.start(wf, { vars: { mode: 'normal' } });
      expect(result.nodeStates['special']!.status).toBe('skipped');
      expect(result.nodeStates['fallback']!.status).toBe('completed');
    });
  });

  describe('HITL gate', () => {
    it('pauses workflow at a HITL gate node', async () => {
      const cfg = createEngineConfig();
      const eng = new DAGWorkflowEngine(cfg);

      const wf = new DAGBuilder('hitl-wf', 'HITL', { manualSentinels: true })
        .addStep({ id: 'start', label: 'Start', type: 'start', config: {} })
        .addStep({ id: 'gate', label: 'Approval', type: 'hitl_gate', config: {} })
        .addStep({ id: 'after', label: 'After', type: 'task', config: { handler: 'echo' } })
        .addStep({ id: 'end', label: 'End', type: 'end', config: {} })
        .addEdge('start', 'gate')
        .addEdge('gate', 'after')
        .addEdge('after', 'end')
        .build();

      const result = await eng.start(wf);
      expect(result.status).toBe('paused');
      expect(result.nodeStates['gate']!.status).toBe('paused');
      expect(result.nodeStates['gate']!.escalationId).toBe('esc-123');
    });

    it('resumes and completes after HITL approval', async () => {
      const cfg = createEngineConfig();
      const eng = new DAGWorkflowEngine(cfg);

      const wf = new DAGBuilder('hitl-resume', 'HITL Resume', { manualSentinels: true })
        .addStep({ id: 'start', label: 'Start', type: 'start', config: {} })
        .addStep({ id: 'gate', label: 'Approval', type: 'hitl_gate', config: {} })
        .addStep({ id: 'after', label: 'After', type: 'task', config: { handler: 'echo' } })
        .addStep({ id: 'end', label: 'End', type: 'end', config: {} })
        .addEdge('start', 'gate')
        .addEdge('gate', 'after')
        .addEdge('after', 'end')
        .build();

      const paused = await eng.start(wf);
      expect(paused.status).toBe('paused');

      const resumed = await eng.resume(wf, paused.executionId, {
        escalationId: 'esc-123',
        approved: true,
        output: { reviewer: 'human' },
      });
      expect(resumed.status).toBe('completed');
      expect(resumed.nodeStates['after']!.status).toBe('completed');
    });
  });

  describe('cancel', () => {
    it('cancels a running workflow', async () => {
      const cfg = createEngineConfig();
      const eng = new DAGWorkflowEngine(cfg);

      const wf = new DAGBuilder('cancel-wf', 'Cancel', { manualSentinels: true })
        .addStep({ id: 'start', label: 'Start', type: 'start', config: {} })
        .addStep({ id: 'gate', label: 'Gate', type: 'hitl_gate', config: {} })
        .addStep({ id: 'end', label: 'End', type: 'end', config: {} })
        .addEdge('start', 'gate')
        .addEdge('gate', 'end')
        .build();

      const paused = await eng.start(wf);
      const cancelled = await eng.cancel(paused.executionId);
      expect(cancelled.status).toBe('cancelled');
    });
  });

  describe('events', () => {
    it('emits workflow:started and workflow:completed events', async () => {
      const events: WorkflowEventPayload[] = [];
      const cfg = createEngineConfig({
        eventListeners: [(payload) => events.push(payload)],
      });
      const eng = new DAGWorkflowEngine(cfg);

      await eng.start(buildLinearWorkflow());

      const eventTypes = events.map((e) => e.event);
      expect(eventTypes).toContain('workflow:started');
      expect(eventTypes).toContain('workflow:completed');
      expect(eventTypes.filter((e) => e === 'node:started').length).toBeGreaterThan(0);
      expect(eventTypes.filter((e) => e === 'node:completed').length).toBeGreaterThan(0);
      expect(eventTypes).toContain('checkpoint:saved');
    });
  });

  describe('getState', () => {
    it('loads state from checkpoint store', async () => {
      const cfg = createEngineConfig();
      const eng = new DAGWorkflowEngine(cfg);

      const result = await eng.start(buildLinearWorkflow());
      const loaded = await eng.getState(result.executionId);
      expect(loaded).not.toBeNull();
      expect(loaded!.executionId).toBe(result.executionId);
    });

    it('returns null for unknown execution', async () => {
      const cfg = createEngineConfig();
      const eng = new DAGWorkflowEngine(cfg);
      expect(await eng.getState('nonexistent')).toBeNull();
    });
  });
});
