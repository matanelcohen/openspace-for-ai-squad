/**
 * Agent Worker Tracing — Unit Tests
 *
 * Verifies that spans are created for the agent worker pipeline:
 *   - Task processing with queue_wait_ms attribute
 *   - Memory recall spans
 *   - Skill matching spans
 *   - Delegation spans
 */
import { describe, expect, it } from 'vitest';

import { instrumentToolCall } from '../instrument-tool.js';
import { TraceCollector } from '../trace-collector.js';
import { Tracer } from '../tracer.js';
import type { Span } from '../types.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeStack() {
  const collected: Span[] = [];
  const collector = new TraceCollector({
    batchSize: 100,
    flushIntervalMs: 0,
    sink: async (batch) => collected.push(...batch),
  });
  const tracer = new Tracer({ serviceName: 'agent-worker-test', collector });
  return { tracer, collected, collector };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Agent Worker Tracing', () => {
  describe('task processing spans', () => {
    it('creates a root span for task processing with queue_wait_ms', async () => {
      const { tracer, collected, collector } = makeStack();

      const queuedAt = Date.now() - 150;
      const startedAt = Date.now();

      await tracer.withSpan('agent:process-task', 'agent', async (ctx) => {
        tracer.setAttributes(ctx.spanId, {
          'task.id': 'task-001',
          'agent.id': 'fry',
          'queue_wait_ms': startedAt - queuedAt,
        });
        await new Promise((r) => setTimeout(r, 5));
      });

      await collector.flush();

      expect(collected).toHaveLength(1);
      const span = collected[0]!;
      expect(span.name).toBe('agent:process-task');
      expect(span.kind).toBe('agent');
      expect(span.status).toBe('ok');
      expect(span.attributes['task.id']).toBe('task-001');
      expect(span.attributes['agent.id']).toBe('fry');
      expect(span.attributes['queue_wait_ms']).toBeTypeOf('number');
      expect(span.attributes['queue_wait_ms'] as number).toBeGreaterThanOrEqual(0);
    });

    it('queue_wait_ms is zero when task is processed immediately', async () => {
      const { tracer, collected, collector } = makeStack();

      await tracer.withSpan('agent:process-task', 'agent', async (ctx) => {
        tracer.setAttributes(ctx.spanId, {
          'task.id': 'task-immediate',
          'queue_wait_ms': 0,
        });
      });

      await collector.flush();

      const span = collected[0]!;
      expect(span.attributes['queue_wait_ms']).toBe(0);
    });
  });

  describe('memory recall spans', () => {
    it('creates a child span for memory recall inside task processing', async () => {
      const { tracer, collected, collector } = makeStack();

      await tracer.withSpan('agent:process-task', 'agent', async (parentCtx) => {
        tracer.setAttributes(parentCtx.spanId, {
          'task.id': 'task-memory-001',
          'agent.id': 'bender',
        });

        await tracer.withSpan('memory:recall', 'internal', async (recallCtx) => {
          tracer.setAttributes(recallCtx.spanId, {
            'memory.query': 'previous deployment patterns',
            'memory.results_count': 3,
            'memory.top_score': 0.85,
          });
          await new Promise((r) => setTimeout(r, 2));
        });

        await tracer.withSpan('tool:code-gen', 'tool', async () => {
          await new Promise((r) => setTimeout(r, 2));
        });
      });

      await collector.flush();

      expect(collected).toHaveLength(3);

      const rootSpan = collected.find((s) => s.name === 'agent:process-task')!;
      const memorySpan = collected.find((s) => s.name === 'memory:recall')!;

      expect(memorySpan.context.parentSpanId).toBe(rootSpan.context.spanId);
      expect(memorySpan.kind).toBe('internal');
      expect(memorySpan.attributes['memory.query']).toBe('previous deployment patterns');
      expect(memorySpan.attributes['memory.results_count']).toBe(3);
      expect(memorySpan.attributes['memory.top_score']).toBe(0.85);
    });

    it('memory recall span records error when recall fails', async () => {
      const { tracer, collected, collector } = makeStack();

      await tracer.withSpan('agent:process-task', 'agent', async () => {
        try {
          await tracer.withSpan('memory:recall', 'internal', async () => {
            throw new Error('FTS5 index corrupt');
          });
        } catch {
          // Memory recall failure is non-critical
        }
      });

      await collector.flush();

      const memorySpan = collected.find((s) => s.name === 'memory:recall')!;
      expect(memorySpan.status).toBe('error');
      expect(memorySpan.events).toHaveLength(1);
      expect(memorySpan.events[0]!.name).toBe('exception');
      expect(memorySpan.events[0]!.attributes?.['exception.message']).toBe(
        'FTS5 index corrupt',
      );
    });

    it('zero recall results still produces a valid span', async () => {
      const { tracer, collected, collector } = makeStack();

      await tracer.withSpan('agent:process-task', 'agent', async () => {
        await tracer.withSpan('memory:recall', 'internal', async (ctx) => {
          tracer.setAttributes(ctx.spanId, {
            'memory.query': 'obscure topic with no matches',
            'memory.results_count': 0,
          });
        });
      });

      await collector.flush();

      const memorySpan = collected.find((s) => s.name === 'memory:recall')!;
      expect(memorySpan.status).toBe('ok');
      expect(memorySpan.attributes['memory.results_count']).toBe(0);
    });
  });

  describe('skill matching spans', () => {
    it('creates a span for skill matching with matched skills', async () => {
      const { tracer, collected, collector } = makeStack();

      await tracer.withSpan('agent:process-task', 'agent', async () => {
        await tracer.withSpan('skills:match', 'internal', async (ctx) => {
          tracer.setAttributes(ctx.spanId, {
            'skills.role': 'frontend',
            'skills.matched_count': 3,
            'skills.matched': JSON.stringify([
              'react-components',
              'css-styling',
              'accessibility',
            ]),
            'skills.top_score': 0.92,
          });
          await new Promise((r) => setTimeout(r, 1));
        });
      });

      await collector.flush();

      const skillSpan = collected.find((s) => s.name === 'skills:match')!;
      expect(skillSpan).toBeDefined();
      expect(skillSpan.kind).toBe('internal');
      expect(skillSpan.status).toBe('ok');
      expect(skillSpan.attributes['skills.role']).toBe('frontend');
      expect(skillSpan.attributes['skills.matched_count']).toBe(3);
    });

    it('skill matching span reflects zero matches gracefully', async () => {
      const { tracer, collected, collector } = makeStack();

      await tracer.withSpan('agent:process-task', 'agent', async () => {
        await tracer.withSpan('skills:match', 'internal', async (ctx) => {
          tracer.setAttributes(ctx.spanId, {
            'skills.role': 'unknown-role',
            'skills.matched_count': 0,
            'skills.matched': '[]',
          });
        });
      });

      await collector.flush();

      const skillSpan = collected.find((s) => s.name === 'skills:match')!;
      expect(skillSpan.attributes['skills.matched_count']).toBe(0);
      expect(skillSpan.status).toBe('ok');
    });
  });

  describe('delegation spans', () => {
    it('creates delegation spans when work is delegated to other agents', async () => {
      const { tracer, collected, collector } = makeStack();

      await tracer.withSpan('agent:lead-process', 'agent', async () => {
        await tracer.withSpan('delegation:route', 'internal', async (ctx) => {
          tracer.setAttributes(ctx.spanId, {
            'delegation.from_agent': 'leela',
            'delegation.to_agent': 'fry',
            'delegation.task_id': 'sub-task-001',
            'delegation.summary': 'Implement login form',
          });
          await new Promise((r) => setTimeout(r, 2));
        });

        await tracer.withSpan('delegation:route', 'internal', async (ctx) => {
          tracer.setAttributes(ctx.spanId, {
            'delegation.from_agent': 'leela',
            'delegation.to_agent': 'bender',
            'delegation.task_id': 'sub-task-002',
            'delegation.summary': 'Set up API endpoint',
          });
          await new Promise((r) => setTimeout(r, 2));
        });
      });

      await collector.flush();

      const delegationSpans = collected.filter(
        (s) => s.name === 'delegation:route',
      );
      expect(delegationSpans).toHaveLength(2);

      const rootSpan = collected.find((s) => s.name === 'agent:lead-process')!;
      for (const ds of delegationSpans) {
        expect(ds.context.parentSpanId).toBe(rootSpan.context.spanId);
        expect(ds.attributes['delegation.from_agent']).toBe('leela');
      }

      const toFry = delegationSpans.find(
        (s) => s.attributes['delegation.to_agent'] === 'fry',
      )!;
      expect(toFry.attributes['delegation.summary']).toBe('Implement login form');

      const toBender = delegationSpans.find(
        (s) => s.attributes['delegation.to_agent'] === 'bender',
      )!;
      expect(toBender.attributes['delegation.summary']).toBe('Set up API endpoint');
    });

    it('delegation span records error when routing fails', async () => {
      const { tracer, collected, collector } = makeStack();

      await tracer.withSpan('agent:lead-process', 'agent', async () => {
        try {
          await tracer.withSpan('delegation:route', 'internal', async (ctx) => {
            tracer.setAttributes(ctx.spanId, {
              'delegation.from_agent': 'leela',
              'delegation.to_agent': 'nonexistent-agent',
            });
            throw new Error('No agent available for delegation');
          });
        } catch {
          // caught
        }
      });

      await collector.flush();

      const delegationSpan = collected.find(
        (s) => s.name === 'delegation:route',
      )!;
      expect(delegationSpan.status).toBe('error');
      expect(delegationSpan.events[0]!.attributes?.['exception.message']).toBe(
        'No agent available for delegation',
      );
    });
  });

  describe('full agent worker pipeline', () => {
    it('creates the full span tree: task → skill match → memory recall → tool calls → delegation', async () => {
      const { tracer, collected, collector } = makeStack();

      const searchTool = instrumentToolCall(tracer, {
        toolId: 'search',
        toolName: 'Code Search',
        fn: async (q: string) => ({ files: [`${q}.ts`] }),
      });

      await tracer.withSpan('agent:process-task', 'agent', async (rootCtx) => {
        tracer.setAttributes(rootCtx.spanId, {
          'task.id': 'full-pipeline-001',
          'agent.id': 'fry',
          'queue_wait_ms': 42,
        });

        await tracer.withSpan('skills:match', 'internal', async (ctx) => {
          tracer.setAttributes(ctx.spanId, { 'skills.matched_count': 2 });
        });

        await tracer.withSpan('memory:recall', 'internal', async (ctx) => {
          tracer.setAttributes(ctx.spanId, { 'memory.results_count': 1 });
        });

        await searchTool('auth-module');

        await tracer.withSpan('delegation:route', 'internal', async (ctx) => {
          tracer.setAttributes(ctx.spanId, {
            'delegation.to_agent': 'bender',
            'delegation.task_id': 'sub-001',
          });
        });
      });

      await collector.flush();

      // 5 spans total: root + skills + memory + tool + delegation
      expect(collected).toHaveLength(5);

      const root = collected.find((s) => s.name === 'agent:process-task')!;
      const children = collected.filter(
        (s) => s.context.parentSpanId === root.context.spanId,
      );
      expect(children).toHaveLength(4);

      expect(children.find((s) => s.name === 'skills:match')).toBeDefined();
      expect(children.find((s) => s.name === 'memory:recall')).toBeDefined();
      expect(children.find((s) => s.kind === 'tool')).toBeDefined();
      expect(children.find((s) => s.name === 'delegation:route')).toBeDefined();

      expect(root.attributes['queue_wait_ms']).toBe(42);
    });
  });
});
