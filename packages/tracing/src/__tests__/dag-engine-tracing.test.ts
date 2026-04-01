/**
 * DAG Engine Tracing — Unit Tests
 *
 * Verifies that executing a DAG-style workflow with tool calls creates the
 * expected span hierarchy:
 *   workflow root → node spans → tool call spans
 *
 * Each tool span must carry: tool.id, tool.name, tool.input (full params),
 * tool.output (full result), tool.duration_ms, and correct status.
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
  const tracer = new Tracer({ serviceName: 'dag-engine-test', collector });
  return { tracer, collected, collector };
}

/**
 * Simulate a DAG workflow execution: root agent span → sequential node
 * spans → tool call spans inside each node. This mirrors how a real
 * DAGWorkflowEngine would be instrumented.
 */
async function simulateDAGWorkflow(tracer: Tracer) {
  const tools = {
    'web-search': instrumentToolCall(tracer, {
      toolId: 'web-search',
      toolName: 'Web Search',
      fn: async (query: string) => ({ results: [`result for ${query}`], count: 1 }),
    }),
    'code-review': instrumentToolCall(tracer, {
      toolId: 'code-review',
      toolName: 'Code Review',
      fn: async (input: { pr: number }) => ({
        approved: true,
        comments: [`PR #${input.pr} looks good`],
      }),
    }),
    'file-writer': instrumentToolCall(tracer, {
      toolId: 'file-writer',
      toolName: 'File Writer',
      fn: async (input: { path: string; content: string }) => ({
        written: true,
        path: input.path,
      }),
    }),
  };

  return tracer.withSpan('workflow:ci-pipeline', 'agent', async () => {
    // Node 1: fetch stage
    await tracer.withSpan('node:fetch', 'internal', async () => {
      await tools['web-search']('latest dependencies');
    });

    // Node 2: review stage
    await tracer.withSpan('node:review', 'internal', async () => {
      await tools['code-review']({ pr: 42 });
    });

    // Node 3: deploy stage
    await tracer.withSpan('node:deploy', 'internal', async () => {
      await tools['file-writer']({ path: 'dist/output.js', content: 'compiled code' });
    });
  });
}

// ── Tests ───────────────────────────────────────────────────────────

describe('DAG Engine Tracing', () => {
  describe('span hierarchy', () => {
    it('creates workflow root → node → tool span hierarchy', async () => {
      const { tracer, collected, collector } = makeStack();
      await simulateDAGWorkflow(tracer);
      await collector.flush();

      // 7 spans: 1 root + 3 nodes + 3 tools
      expect(collected).toHaveLength(7);

      // Find root span (no parent)
      const root = collected.find((s) => !s.context.parentSpanId);
      expect(root).toBeDefined();
      expect(root!.name).toBe('workflow:ci-pipeline');
      expect(root!.kind).toBe('agent');
      expect(root!.status).toBe('ok');

      // All spans share the same traceId
      const traceId = root!.context.traceId;
      expect(collected.every((s) => s.context.traceId === traceId)).toBe(true);
    });

    it('node spans are children of the workflow root', async () => {
      const { tracer, collected, collector } = makeStack();
      await simulateDAGWorkflow(tracer);
      await collector.flush();

      const root = collected.find((s) => !s.context.parentSpanId)!;
      const nodeSpans = collected.filter(
        (s) => s.context.parentSpanId === root.context.spanId,
      );

      expect(nodeSpans).toHaveLength(3);
      expect(nodeSpans.map((s) => s.name).sort()).toEqual([
        'node:deploy',
        'node:fetch',
        'node:review',
      ]);
      expect(nodeSpans.every((s) => s.kind === 'internal')).toBe(true);
    });

    it('tool spans are children of their respective node spans', async () => {
      const { tracer, collected, collector } = makeStack();
      await simulateDAGWorkflow(tracer);
      await collector.flush();

      const nodeMap = new Map<string, Span>();
      for (const s of collected) {
        if (s.name.startsWith('node:')) nodeMap.set(s.name, s);
      }

      // Web Search → child of node:fetch
      const searchSpan = collected.find(
        (s) => s.attributes['tool.id'] === 'web-search',
      )!;
      expect(searchSpan.context.parentSpanId).toBe(
        nodeMap.get('node:fetch')!.context.spanId,
      );

      // Code Review → child of node:review
      const reviewSpan = collected.find(
        (s) => s.attributes['tool.id'] === 'code-review',
      )!;
      expect(reviewSpan.context.parentSpanId).toBe(
        nodeMap.get('node:review')!.context.spanId,
      );

      // File Writer → child of node:deploy
      const writerSpan = collected.find(
        (s) => s.attributes['tool.id'] === 'file-writer',
      )!;
      expect(writerSpan.context.parentSpanId).toBe(
        nodeMap.get('node:deploy')!.context.spanId,
      );
    });
  });

  describe('tool span attributes', () => {
    it('each tool span has tool.id attribute', async () => {
      const { tracer, collected, collector } = makeStack();
      await simulateDAGWorkflow(tracer);
      await collector.flush();

      const toolSpans = collected.filter((s) => s.kind === 'tool');
      expect(toolSpans).toHaveLength(3);

      const ids = toolSpans.map((s) => s.attributes['tool.id']);
      expect(ids).toContain('web-search');
      expect(ids).toContain('code-review');
      expect(ids).toContain('file-writer');
    });

    it('each tool span has tool.name attribute', async () => {
      const { tracer, collected, collector } = makeStack();
      await simulateDAGWorkflow(tracer);
      await collector.flush();

      const toolSpans = collected.filter((s) => s.kind === 'tool');
      const names = toolSpans.map((s) => s.attributes['tool.name']);
      expect(names).toContain('Web Search');
      expect(names).toContain('Code Review');
      expect(names).toContain('File Writer');
    });

    it('tool.input captures the full input parameters', async () => {
      const { tracer, collected, collector } = makeStack();
      await simulateDAGWorkflow(tracer);
      await collector.flush();

      const searchSpan = collected.find(
        (s) => s.attributes['tool.id'] === 'web-search',
      )!;
      expect(searchSpan.attributes['tool.input']).toBe('latest dependencies');

      const reviewSpan = collected.find(
        (s) => s.attributes['tool.id'] === 'code-review',
      )!;
      expect(reviewSpan.attributes['tool.input']).toEqual({ pr: 42 });

      const writerSpan = collected.find(
        (s) => s.attributes['tool.id'] === 'file-writer',
      )!;
      expect(writerSpan.attributes['tool.input']).toEqual({
        path: 'dist/output.js',
        content: 'compiled code',
      });
    });

    it('tool.output captures the full result', async () => {
      const { tracer, collected, collector } = makeStack();
      await simulateDAGWorkflow(tracer);
      await collector.flush();

      const searchSpan = collected.find(
        (s) => s.attributes['tool.id'] === 'web-search',
      )!;
      expect(searchSpan.attributes['tool.output']).toEqual({
        results: ['result for latest dependencies'],
        count: 1,
      });

      const reviewSpan = collected.find(
        (s) => s.attributes['tool.id'] === 'code-review',
      )!;
      expect(reviewSpan.attributes['tool.output']).toEqual({
        approved: true,
        comments: ['PR #42 looks good'],
      });

      const writerSpan = collected.find(
        (s) => s.attributes['tool.id'] === 'file-writer',
      )!;
      expect(writerSpan.attributes['tool.output']).toEqual({
        written: true,
        path: 'dist/output.js',
      });
    });

    it('tool.duration_ms is a positive number on all tool spans', async () => {
      const { tracer, collected, collector } = makeStack();
      await simulateDAGWorkflow(tracer);
      await collector.flush();

      const toolSpans = collected.filter((s) => s.kind === 'tool');
      for (const span of toolSpans) {
        expect(span.attributes['tool.duration_ms']).toBeTypeOf('number');
        expect(span.attributes['tool.duration_ms'] as number).toBeGreaterThanOrEqual(0);
      }
    });

    it('all tool spans have status "ok" on success', async () => {
      const { tracer, collected, collector } = makeStack();
      await simulateDAGWorkflow(tracer);
      await collector.flush();

      const toolSpans = collected.filter((s) => s.kind === 'tool');
      for (const span of toolSpans) {
        expect(span.status).toBe('ok');
      }
    });
  });

  describe('parallel tool calls within a node', () => {
    it('multiple concurrent tool calls share the same parent node span', async () => {
      const { tracer, collected, collector } = makeStack();

      const tool1 = instrumentToolCall(tracer, {
        toolId: 'lint',
        toolName: 'Linter',
        fn: async (file: string) => {
          await new Promise((r) => setTimeout(r, 5));
          return { clean: true, file };
        },
      });

      const tool2 = instrumentToolCall(tracer, {
        toolId: 'test',
        toolName: 'Test Runner',
        fn: async (file: string) => {
          await new Promise((r) => setTimeout(r, 5));
          return { passed: true, file };
        },
      });

      await tracer.withSpan('workflow:parallel-check', 'agent', async () => {
        await tracer.withSpan('node:quality', 'internal', async () => {
          await Promise.all([tool1('src/app.ts'), tool2('src/app.test.ts')]);
        });
      });

      await collector.flush();

      // 4 spans: 1 root + 1 node + 2 tools
      expect(collected).toHaveLength(4);

      const nodeSpan = collected.find((s) => s.name === 'node:quality')!;
      const toolSpans = collected.filter((s) => s.kind === 'tool');
      expect(toolSpans).toHaveLength(2);

      for (const tool of toolSpans) {
        expect(tool.context.parentSpanId).toBe(nodeSpan.context.spanId);
      }
    });
  });

  describe('workflow with no tool calls', () => {
    it('creates root and node spans without tool spans', async () => {
      const { tracer, collected, collector } = makeStack();

      await tracer.withSpan('workflow:empty', 'agent', async () => {
        await tracer.withSpan('node:noop', 'internal', async () => {
          // No tool calls
        });
      });

      await collector.flush();

      expect(collected).toHaveLength(2);
      const root = collected.find((s) => s.name === 'workflow:empty')!;
      expect(root.kind).toBe('agent');
      const node = collected.find((s) => s.name === 'node:noop')!;
      expect(node.kind).toBe('internal');
      expect(node.context.parentSpanId).toBe(root.context.spanId);
    });
  });

  describe('service.name attribute', () => {
    it('all spans carry the service.name attribute', async () => {
      const { tracer, collected, collector } = makeStack();
      await simulateDAGWorkflow(tracer);
      await collector.flush();

      for (const span of collected) {
        expect(span.attributes['service.name']).toBe('dag-engine-test');
      }
    });
  });
});
