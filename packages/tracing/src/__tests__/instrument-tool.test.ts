import { describe, expect, it } from 'vitest';

import { instrumentToolCall } from '../instrument-tool.js';
import { TraceCollector } from '../trace-collector.js';
import { Tracer } from '../tracer.js';
import type { Span } from '../types.js';

describe('instrumentToolCall', () => {
  function setup() {
    const collected: Span[] = [];
    const collector = new TraceCollector({
      batchSize: 100,
      flushIntervalMs: 0,
      sink: async (batch) => {
        collected.push(...batch);
      },
    });
    const tracer = new Tracer({ serviceName: 'test', collector });
    return { tracer, collected, collector };
  }

  it('wraps a tool call and captures input/output/latency', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentToolCall(tracer, {
      toolId: 'search',
      toolName: 'Web Search',
      fn: async (query: string) => ({ results: [query] }),
    });

    const result = await traced('hello');
    await collector.flush();

    expect(result).toEqual({ results: ['hello'] });
    expect(collected).toHaveLength(1);

    const span = collected[0]!;
    expect(span.name).toBe('tool:Web Search');
    expect(span.kind).toBe('tool');
    expect(span.status).toBe('ok');
    expect(span.attributes['tool.id']).toBe('search');
    expect(span.attributes['tool.name']).toBe('Web Search');
    expect(span.attributes['tool.input']).toBe('hello');
    expect(span.attributes['tool.output']).toEqual({ results: ['hello'] });
    expect(span.attributes['tool.duration_ms']).toBeTypeOf('number');
  });

  it('captures errors from tool calls', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentToolCall(tracer, {
      toolId: 'fail-tool',
      toolName: 'Failing Tool',
      fn: async () => {
        throw new Error('connection refused');
      },
    });

    await expect(traced('input')).rejects.toThrow('connection refused');
    await collector.flush();

    expect(collected).toHaveLength(1);
    const span = collected[0]!;
    expect(span.status).toBe('error');
    expect(span.attributes['tool.error']).toBe('connection refused');
    expect(span.attributes['tool.duration_ms']).toBeTypeOf('number');
  });

  it('inherits parent span context when nested', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentToolCall(tracer, {
      toolId: 'nested-tool',
      toolName: 'Nested',
      fn: async (x: number) => x * 2,
    });

    await tracer.withSpan('agent-task', 'agent', async (parentCtx) => {
      const result = await traced(21);
      expect(result).toBe(42);

      await collector.flush();
      const toolSpan = collected.find((s) => s.kind === 'tool')!;
      expect(toolSpan.context.traceId).toBe(parentCtx.traceId);
      expect(toolSpan.context.parentSpanId).toBe(parentCtx.spanId);
    });
  });
});
