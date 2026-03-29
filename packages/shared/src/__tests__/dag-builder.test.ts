import { describe, expect, it } from 'vitest';

import type { ConditionalPredicate, DAGWorkflow, StepNode } from '../types/dag-workflow.js';
import { DAGBuilder, DAGBuilderError } from '../workflow/dag-builder.js';

// ── Helpers ─────────────────────────────────────────────────────

function taskStep(id: string, label?: string): Parameters<DAGBuilder['addStep']>[0] {
  return {
    id,
    label: label ?? id,
    type: 'task',
    config: { handler: 'echo' },
  };
}

// ── Tests ───────────────────────────────────────────────────────

describe('DAGBuilder', () => {
  describe('addStep', () => {
    it('adds a step and increments stepCount', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      expect(builder.stepCount).toBe(0);
      builder.addStep(taskStep('a'));
      expect(builder.stepCount).toBe(1);
    });

    it('returns this for chaining', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      const result = builder.addStep(taskStep('a'));
      expect(result).toBe(builder);
    });

    it('throws on duplicate step ID', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a'));
      expect(() => builder.addStep(taskStep('a'))).toThrow(DAGBuilderError);
      expect(() => builder.addStep(taskStep('a'))).toThrow('Duplicate step ID');
    });

    it('preserves optional fields (timeoutMs, retries, retryDelayMs, onFailure, metadata)', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep({
        id: 'step-1',
        label: 'Step 1',
        type: 'task',
        config: { handler: 'echo' },
        timeoutMs: 5000,
        retries: 3,
        retryDelayMs: 100,
        onFailure: 'skip',
        metadata: { color: 'blue' },
      });
      const wf = builder.build();
      const node = wf.nodes.find((n) => n.id === 'step-1');
      expect(node?.timeoutMs).toBe(5000);
      expect(node?.retries).toBe(3);
      expect(node?.retryDelayMs).toBe(100);
      expect(node?.onFailure).toBe('skip');
      expect(node?.metadata).toEqual({ color: 'blue' });
    });
  });

  describe('addEdge', () => {
    it('adds an edge and increments edgeCount', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a')).addStep(taskStep('b'));
      expect(builder.edgeCount).toBe(0);
      builder.addEdge('a', 'b');
      expect(builder.edgeCount).toBe(1);
    });

    it('returns this for chaining', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a')).addStep(taskStep('b'));
      expect(builder.addEdge('a', 'b')).toBe(builder);
    });

    it('supports optional label', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a')).addStep(taskStep('b'));
      builder.addEdge('a', 'b', 'on-success');
      const wf = builder.build();
      const edge = wf.edges.find((e) => e.from === 'a' && e.to === 'b');
      expect(edge?.label).toBe('on-success');
    });
  });

  describe('addConditionalEdge', () => {
    it('adds a conditional edge with predicate', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder
        .addStep({ id: 'check', label: 'Check', type: 'condition', config: { predicate: { type: 'comparison', field: 'output.status', operator: 'eq', value: 'ok' } } })
        .addStep(taskStep('yes'))
        .addStep(taskStep('no'));

      const predicate: ConditionalPredicate = {
        type: 'comparison',
        field: 'output.status',
        operator: 'eq',
        value: 'ok',
      };

      builder.addConditionalEdge('check', 'yes', predicate, { label: 'success', priority: 0 });
      builder.addEdge('check', 'no');

      const wf = builder.build();
      const condEdge = wf.edges.find((e) => e.from === 'check' && e.to === 'yes');
      expect(condEdge?.condition).toEqual(predicate);
      expect(condEdge?.label).toBe('success');
      expect(condEdge?.priority).toBe(0);
    });

    it('returns this for chaining', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a')).addStep(taskStep('b'));
      const result = builder.addConditionalEdge('a', 'b', {
        type: 'comparison',
        field: 'output.x',
        operator: 'eq',
        value: 1,
      });
      expect(result).toBe(builder);
    });
  });

  describe('validate', () => {
    it('returns empty array for a valid linear workflow', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a')).addStep(taskStep('b')).addEdge('a', 'b');
      expect(builder.validate()).toEqual([]);
    });

    it('detects cycles', () => {
      const builder = new DAGBuilder('w1', 'Workflow', { manualSentinels: true });
      builder
        .addStep({ id: 'start', label: 'Start', type: 'start', config: {} })
        .addStep(taskStep('a'))
        .addStep(taskStep('b'))
        .addStep({ id: 'end', label: 'End', type: 'end', config: {} })
        .addEdge('start', 'a')
        .addEdge('a', 'b')
        .addEdge('b', 'a') // cycle
        .addEdge('b', 'end');

      const errors = builder.validate();
      expect(errors.some((e) => e.includes('cycle'))).toBe(true);
    });

    it('detects edges referencing unknown nodes', () => {
      const builder = new DAGBuilder('w1', 'Workflow', { manualSentinels: true });
      builder
        .addStep({ id: 'start', label: 'Start', type: 'start', config: {} })
        .addStep({ id: 'end', label: 'End', type: 'end', config: {} })
        .addEdge('start', 'ghost');

      const errors = builder.validate();
      expect(errors.some((e) => e.includes('ghost'))).toBe(true);
    });
  });

  describe('build', () => {
    it('auto-injects start and end sentinel nodes', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a'));
      const wf = builder.build();

      const start = wf.nodes.find((n) => n.type === 'start');
      const end = wf.nodes.find((n) => n.type === 'end');
      expect(start).toBeDefined();
      expect(end).toBeDefined();
    });

    it('wires start to root nodes and leaf nodes to end', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a')).addStep(taskStep('b')).addEdge('a', 'b');
      const wf = builder.build();

      // __start__ → a
      expect(wf.edges.some((e) => e.from === '__start__' && e.to === 'a')).toBe(true);
      // b → __end__
      expect(wf.edges.some((e) => e.from === 'b' && e.to === '__end__')).toBe(true);
    });

    it('skips sentinel injection when manualSentinels is true', () => {
      const builder = new DAGBuilder('w1', 'Workflow', { manualSentinels: true });
      builder
        .addStep({ id: 'start', label: 'Start', type: 'start', config: {} })
        .addStep(taskStep('a'))
        .addStep({ id: 'end', label: 'End', type: 'end', config: {} })
        .addEdge('start', 'a')
        .addEdge('a', 'end');

      const wf = builder.build();
      expect(wf.nodes.find((n) => n.id === '__start__')).toBeUndefined();
      expect(wf.nodes.find((n) => n.id === '__end__')).toBeUndefined();
    });

    it('throws DAGBuilderError with validationErrors for invalid graph', () => {
      const builder = new DAGBuilder('w1', 'Workflow', { manualSentinels: true });
      // No start or end nodes
      builder.addStep(taskStep('a'));
      try {
        builder.build();
        expect.unreachable('should have thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(DAGBuilderError);
        expect((e as DAGBuilderError).validationErrors).toBeDefined();
        expect((e as DAGBuilderError).validationErrors!.length).toBeGreaterThan(0);
      }
    });

    it('includes version, description, and other options', () => {
      const builder = new DAGBuilder('w1', 'Workflow', {
        version: '2.0.0',
        description: 'A test workflow',
        defaultVars: { env: 'prod' },
        requiredSecrets: ['API_KEY'],
        timeoutMs: 60000,
        metadata: { team: 'backend' },
      });
      builder.addStep(taskStep('a'));
      const wf = builder.build();
      expect(wf.version).toBe('2.0.0');
      expect(wf.description).toBe('A test workflow');
      expect(wf.defaultVars).toEqual({ env: 'prod' });
      expect(wf.requiredSecrets).toEqual(['API_KEY']);
      expect(wf.timeoutMs).toBe(60000);
      expect(wf.metadata).toEqual({ team: 'backend' });
    });
  });

  describe('wouldCycle', () => {
    it('returns false for a valid edge', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a')).addStep(taskStep('b'));
      expect(builder.wouldCycle('a', 'b')).toBe(false);
    });

    it('returns true if edge would create a cycle', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a')).addStep(taskStep('b'));
      builder.addEdge('a', 'b');
      expect(builder.wouldCycle('b', 'a')).toBe(true);
    });

    it('does not mutate the builder state', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a')).addStep(taskStep('b'));
      builder.addEdge('a', 'b');
      builder.wouldCycle('b', 'a');
      expect(builder.edgeCount).toBe(1); // still 1
    });
  });

  describe('removeStep', () => {
    it('removes a step and all its edges', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder
        .addStep(taskStep('a'))
        .addStep(taskStep('b'))
        .addStep(taskStep('c'))
        .addEdge('a', 'b')
        .addEdge('b', 'c');

      builder.removeStep('b');
      expect(builder.stepCount).toBe(2);
      expect(builder.edgeCount).toBe(0);
    });
  });

  describe('removeEdge', () => {
    it('removes a specific edge by from/to', () => {
      const builder = new DAGBuilder('w1', 'Workflow');
      builder.addStep(taskStep('a')).addStep(taskStep('b')).addEdge('a', 'b');
      builder.removeEdge('a', 'b');
      expect(builder.edgeCount).toBe(0);
    });
  });

  describe('complex workflow', () => {
    it('builds a diamond workflow (parallel paths)', () => {
      const builder = new DAGBuilder('diamond', 'Diamond');
      builder
        .addStep(taskStep('fetch'))
        .addStep(taskStep('lint'))
        .addStep(taskStep('test'))
        .addStep(taskStep('deploy'))
        .addEdge('fetch', 'lint')
        .addEdge('fetch', 'test')
        .addEdge('lint', 'deploy')
        .addEdge('test', 'deploy');

      const wf = builder.build();
      expect(wf.nodes.length).toBe(6); // 4 user + start + end
      expect(wf.edges.length).toBe(6); // 4 user + start→fetch + deploy→end
    });
  });
});
