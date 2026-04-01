/**
 * Trace Enrichment — Unit Tests
 *
 * Verifies that tool and LLM instrumentation produce correctly enriched spans
 * with all expected attributes, including edge cases and error paths.
 */
import { describe, expect, it } from 'vitest';

import { instrumentLLMCall } from '../instrument-llm.js';
import { instrumentToolCall } from '../instrument-tool.js';
import { TraceCollector } from '../trace-collector.js';
import { Tracer } from '../tracer.js';
import type { ModelPriceTable, Span } from '../types.js';

// ── Helpers ──────────────────────────────────────────────────────────

function setup() {
  const collected: Span[] = [];
  const collector = new TraceCollector({
    batchSize: 100,
    flushIntervalMs: 0,
    sink: async (batch) => {
      collected.push(...batch);
    },
  });
  const tracer = new Tracer({ serviceName: 'enrichment-test', collector });
  return { tracer, collected, collector };
}

const PRICE_TABLE: ModelPriceTable = [
  { model: 'gpt-4o', promptPricePer1k: 0.005, completionPricePer1k: 0.015 },
  { model: 'gpt-4o-mini', promptPricePer1k: 0.00015, completionPricePer1k: 0.0006 },
  { model: 'claude-3-sonnet', promptPricePer1k: 0.003, completionPricePer1k: 0.015 },
];

// ── 1. Tool Instrumentation Enrichment ───────────────────────────────

describe('instrumentToolCall — enrichment', () => {
  it('sets tool.name, tool.input, tool.output, tool.duration_ms on success', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentToolCall(tracer, {
      toolId: 'file-reader',
      toolName: 'File Reader',
      fn: async (path: string) => ({ content: `data from ${path}`, lines: 42 }),
    });

    const result = await traced('/tmp/config.yaml');
    await collector.flush();

    expect(result).toEqual({ content: 'data from /tmp/config.yaml', lines: 42 });
    expect(collected).toHaveLength(1);

    const span = collected[0]!;
    expect(span.kind).toBe('tool');
    expect(span.status).toBe('ok');
    expect(span.attributes['tool.id']).toBe('file-reader');
    expect(span.attributes['tool.name']).toBe('File Reader');
    expect(span.attributes['tool.input']).toBe('/tmp/config.yaml');
    expect(span.attributes['tool.output']).toEqual({ content: 'data from /tmp/config.yaml', lines: 42 });
    expect(span.attributes['tool.duration_ms']).toBeTypeOf('number');
    expect(span.attributes['tool.duration_ms']).toBeGreaterThanOrEqual(0);
  });

  it('captures tool.error and exception event on failure', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentToolCall(tracer, {
      toolId: 'db-query',
      toolName: 'Database Query',
      fn: async () => {
        throw new Error('ECONNREFUSED: connection refused');
      },
    });

    await expect(traced('SELECT 1')).rejects.toThrow('ECONNREFUSED');
    await collector.flush();

    expect(collected).toHaveLength(1);
    const span = collected[0]!;

    expect(span.status).toBe('error');
    expect(span.attributes['tool.error']).toBe('ECONNREFUSED: connection refused');
    expect(span.attributes['tool.duration_ms']).toBeTypeOf('number');

    // Tracer.withSpan records an exception event
    const exceptionEvent = span.events.find((e) => e.name === 'exception');
    expect(exceptionEvent).toBeDefined();
    expect(exceptionEvent!.attributes?.['exception.message']).toBe(
      'ECONNREFUSED: connection refused',
    );
  });

  it('captures non-Error thrown values as string', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentToolCall(tracer, {
      toolId: 'quirky-tool',
      toolName: 'Quirky',
      fn: async () => {
        throw 'string_error_value'; // eslint-disable-line no-throw-literal
      },
    });

    await expect(traced('x')).rejects.toBe('string_error_value');
    await collector.flush();

    const span = collected[0]!;
    expect(span.status).toBe('error');
    expect(span.attributes['tool.error']).toBe('string_error_value');
  });

  it('handles complex object input serialization', async () => {
    const { tracer, collected, collector } = setup();

    const complexInput = {
      query: 'climate data',
      filters: { year: 2025, region: 'EU' },
      options: { limit: 10, format: 'json' },
    };

    const traced = instrumentToolCall(tracer, {
      toolId: 'search-api',
      toolName: 'Search API',
      fn: async (input: typeof complexInput) => ({ count: 5, query: input.query }),
    });

    await traced(complexInput);
    await collector.flush();

    const span = collected[0]!;
    expect(span.attributes['tool.input']).toEqual(complexInput);
    expect(span.attributes['tool.output']).toEqual({ count: 5, query: 'climate data' });
  });

  it('records zero-ish duration for instant operations', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentToolCall(tracer, {
      toolId: 'fast-tool',
      toolName: 'Fast',
      fn: async (x: number) => x + 1,
    });

    await traced(0);
    await collector.flush();

    const dur = collected[0]!.attributes['tool.duration_ms'] as number;
    expect(dur).toBeGreaterThanOrEqual(0);
    // Should be very fast (< 50ms even on slow CI)
    expect(dur).toBeLessThan(50);
  });

  it('preserves tool.input = undefined when no input given', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentToolCall(tracer, {
      toolId: 'no-input',
      toolName: 'NoInput',
      fn: async (input: undefined) => 'done',
    });

    await traced(undefined as unknown as undefined);
    await collector.flush();

    const span = collected[0]!;
    expect(span.attributes['tool.input']).toBeUndefined();
    expect(span.attributes['tool.output']).toBe('done');
  });

  it('correctly nests under a parent agent span with shared traceId', async () => {
    const { tracer, collected, collector } = setup();

    const tool1 = instrumentToolCall(tracer, {
      toolId: 'tool-a',
      toolName: 'Tool A',
      fn: async () => 'result-a',
    });

    const tool2 = instrumentToolCall(tracer, {
      toolId: 'tool-b',
      toolName: 'Tool B',
      fn: async () => 'result-b',
    });

    await tracer.withSpan('agent:orchestrator', 'agent', async (agentCtx) => {
      await tool1('input-a');
      await tool2('input-b');

      await collector.flush();

      // All 3 spans share the same traceId
      for (const span of collected) {
        expect(span.context.traceId).toBe(agentCtx.traceId);
      }

      // Tool spans are children of agent
      const tools = collected.filter((s) => s.kind === 'tool');
      expect(tools).toHaveLength(2);
      for (const t of tools) {
        expect(t.context.parentSpanId).toBe(agentCtx.spanId);
      }
    });
  });
});

// ── 2. LLM Instrumentation Enrichment ────────────────────────────────

describe('instrumentLLMCall — enrichment', () => {
  it('captures llm.model, tokens, cost, and duration on success', async () => {
    const { tracer, collected, collector } = setup();

    interface LLMRes {
      text: string;
      usage: { prompt_tokens: number; completion_tokens: number };
    }

    const traced = instrumentLLMCall(
      tracer,
      {
        model: 'gpt-4o',
        provider: 'openai',
        fn: async (prompt: string): Promise<LLMRes> => ({
          text: `response to ${prompt}`,
          usage: { prompt_tokens: 250, completion_tokens: 80 },
        }),
        extractUsage: (res) => ({
          promptTokens: res.usage.prompt_tokens,
          completionTokens: res.usage.completion_tokens,
        }),
      },
      PRICE_TABLE,
    );

    const result = await traced('Summarize the document');
    await collector.flush();

    expect(result.text).toBe('response to Summarize the document');

    const span = collected[0]!;
    expect(span.kind).toBe('llm');
    expect(span.status).toBe('ok');
    expect(span.attributes['llm.model']).toBe('gpt-4o');
    expect(span.attributes['llm.provider']).toBe('openai');
    expect(span.attributes['llm.prompt_tokens']).toBe(250);
    expect(span.attributes['llm.completion_tokens']).toBe(80);
    expect(span.attributes['llm.total_tokens']).toBe(330);
    expect(span.attributes['llm.cost_usd']).toBeTypeOf('number');
    expect(span.attributes['llm.cost_usd']).toBeGreaterThan(0);
    expect(span.attributes['llm.total_duration_ms']).toBeTypeOf('number');

    // Token usage promoted to span-level field
    expect(span.tokenUsage).toBeDefined();
    expect(span.tokenUsage!.promptTokens).toBe(250);
    expect(span.tokenUsage!.completionTokens).toBe(80);
    expect(span.tokenUsage!.totalTokens).toBe(330);

    // Cost promoted to span-level
    expect(span.costUsd).toBeTypeOf('number');
    expect(span.costUsd).toBeGreaterThan(0);
  });

  it('records llm.stream.start event when streaming is true', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentLLMCall(tracer, {
      model: 'gpt-4o',
      streaming: true,
      fn: async () => 'streamed response',
    });

    await traced('prompt');
    await collector.flush();

    const span = collected[0]!;
    expect(span.attributes['llm.streaming']).toBe(true);

    const streamEvent = span.events.find((e) => e.name === 'llm.stream.start');
    expect(streamEvent).toBeDefined();
    expect(streamEvent!.timestamp).toBeTypeOf('number');
    expect(streamEvent!.timestamp).toBeGreaterThan(0);
  });

  it('does not record streaming event when streaming is false', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentLLMCall(tracer, {
      model: 'gpt-4o',
      streaming: false,
      fn: async () => 'result',
    });

    await traced('prompt');
    await collector.flush();

    const span = collected[0]!;
    expect(span.attributes['llm.streaming']).toBe(false);
    expect(span.events.some((e) => e.name === 'llm.stream.start')).toBe(false);
  });

  it('omits token attributes when extractUsage is not provided', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentLLMCall(tracer, {
      model: 'custom-local-model',
      fn: async (prompt: string) => `echo: ${prompt}`,
    });

    await traced('test');
    await collector.flush();

    const span = collected[0]!;
    expect(span.attributes['llm.model']).toBe('custom-local-model');
    expect(span.attributes['llm.prompt_tokens']).toBeUndefined();
    expect(span.attributes['llm.completion_tokens']).toBeUndefined();
    expect(span.attributes['llm.total_tokens']).toBeUndefined();
    expect(span.attributes['llm.cost_usd']).toBeUndefined();
    expect(span.tokenUsage).toBeUndefined();
    expect(span.costUsd).toBeUndefined();
    // But duration should always be present
    expect(span.attributes['llm.total_duration_ms']).toBeTypeOf('number');
  });

  it('computes cost correctly with different models from price table', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentLLMCall(
      tracer,
      {
        model: 'gpt-4o-mini',
        fn: async () => ({ usage: { p: 1000, c: 500 } }),
        extractUsage: (r) => ({
          promptTokens: r.usage.p,
          completionTokens: r.usage.c,
        }),
      },
      PRICE_TABLE,
    );

    await traced('cheap prompt');
    await collector.flush();

    const span = collected[0]!;
    // gpt-4o-mini: 1000/1000 * 0.00015 + 500/1000 * 0.0006 = 0.00015 + 0.0003 = 0.00045
    expect(span.attributes['llm.cost_usd']).toBeCloseTo(0.00045, 6);
  });

  it('captures error from LLM call with exception event', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentLLMCall(tracer, {
      model: 'gpt-4o',
      provider: 'openai',
      fn: async () => {
        const err = new Error('429 Too Many Requests');
        throw err;
      },
    });

    await expect(traced('prompt')).rejects.toThrow('429 Too Many Requests');
    await collector.flush();

    const span = collected[0]!;
    expect(span.status).toBe('error');

    // Exception event recorded by withSpan
    const exceptionEvent = span.events.find((e) => e.name === 'exception');
    expect(exceptionEvent).toBeDefined();
    expect(exceptionEvent!.attributes?.['exception.message']).toBe('429 Too Many Requests');
  });

  it('handles extractUsage returning partial data (only promptTokens)', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentLLMCall(
      tracer,
      {
        model: 'gpt-4o',
        fn: async () => ({ partialUsage: 100 }),
        extractUsage: (r) => ({
          promptTokens: r.partialUsage,
          // completionTokens intentionally omitted
        }),
      },
      PRICE_TABLE,
    );

    await traced('prompt');
    await collector.flush();

    const span = collected[0]!;
    expect(span.attributes['llm.prompt_tokens']).toBe(100);
    // completionTokens undefined → totalTokens = 100 + 0
    expect(span.attributes['llm.total_tokens']).toBe(100);
  });

  it('multiple LLM calls under agent span aggregate correctly', async () => {
    const { tracer, collected, collector } = setup();

    const llm = instrumentLLMCall(
      tracer,
      {
        model: 'gpt-4o',
        fn: async () => ({ usage: { p: 100, c: 50 } }),
        extractUsage: (r) => ({ promptTokens: r.usage.p, completionTokens: r.usage.c }),
      },
      PRICE_TABLE,
    );

    await tracer.withSpan('agent:planner', 'agent', async () => {
      await llm('step 1');
      await llm('step 2');
      await llm('step 3');
    });

    await collector.flush();

    const llmSpans = collected.filter((s) => s.kind === 'llm');
    expect(llmSpans).toHaveLength(3);

    // Each LLM span should have identical token counts
    for (const span of llmSpans) {
      expect(span.tokenUsage?.promptTokens).toBe(100);
      expect(span.tokenUsage?.completionTokens).toBe(50);
      expect(span.costUsd).toBeGreaterThan(0);
    }

    // Agent span should NOT have token usage (not an LLM span)
    const agentSpan = collected.find((s) => s.kind === 'agent');
    expect(agentSpan).toBeDefined();
    expect(agentSpan!.tokenUsage).toBeUndefined();
  });
});

// ── 3. Combined Tool + LLM enrichment in agent trace ─────────────────

describe('combined enrichment — agent → tools → LLM', () => {
  it('produces a complete enriched trace with correct parent-child relationships', async () => {
    const { tracer, collected, collector } = setup();

    const search = instrumentToolCall(tracer, {
      toolId: 'web-search',
      toolName: 'Web Search',
      fn: async (q: string) => ({ results: [`${q} result`], count: 1 }),
    });

    const llm = instrumentLLMCall(
      tracer,
      {
        model: 'gpt-4o',
        provider: 'openai',
        fn: async (prompt: string) => ({
          text: `summary of ${prompt}`,
          usage: { prompt_tokens: 400, completion_tokens: 150 },
        }),
        extractUsage: (r) => ({
          promptTokens: r.usage.prompt_tokens,
          completionTokens: r.usage.completion_tokens,
        }),
      },
      PRICE_TABLE,
    );

    const calc = instrumentToolCall(tracer, {
      toolId: 'calculator',
      toolName: 'Calculator',
      fn: async (expr: string) => eval(expr), // eslint-disable-line no-eval
    });

    let rootTraceId: string;
    let rootSpanId: string;

    await tracer.withSpan('agent:researcher', 'agent', async (agentCtx) => {
      rootTraceId = agentCtx.traceId;
      rootSpanId = agentCtx.spanId;

      await search('quantum computing');
      await llm('Summarize quantum computing results');
      await calc('2 + 2');
    });

    await collector.flush();

    // Should produce 4 spans: agent + 2 tools + 1 LLM
    expect(collected).toHaveLength(4);

    // Verify all share the same traceId
    for (const span of collected) {
      expect(span.context.traceId).toBe(rootTraceId!);
    }

    // Agent span is root (no parent)
    const agentSpan = collected.find((s) => s.kind === 'agent')!;
    expect(agentSpan.context.parentSpanId).toBeUndefined();
    expect(agentSpan.name).toBe('agent:researcher');

    // Tool and LLM spans are children of agent
    const childSpans = collected.filter((s) => s.context.parentSpanId === rootSpanId!);
    expect(childSpans).toHaveLength(3);

    // Verify tool span attributes
    const searchSpan = childSpans.find((s) => s.attributes['tool.name'] === 'Web Search')!;
    expect(searchSpan.attributes['tool.input']).toBe('quantum computing');
    expect(searchSpan.attributes['tool.output']).toEqual({
      results: ['quantum computing result'],
      count: 1,
    });

    const calcSpan = childSpans.find((s) => s.attributes['tool.name'] === 'Calculator')!;
    expect(calcSpan.attributes['tool.input']).toBe('2 + 2');
    expect(calcSpan.attributes['tool.output']).toBe(4);

    // Verify LLM span attributes
    const llmSpan = childSpans.find((s) => s.kind === 'llm')!;
    expect(llmSpan.attributes['llm.model']).toBe('gpt-4o');
    expect(llmSpan.attributes['llm.prompt_tokens']).toBe(400);
    expect(llmSpan.attributes['llm.completion_tokens']).toBe(150);
    expect(llmSpan.tokenUsage!.totalTokens).toBe(550);
    expect(llmSpan.costUsd).toBeGreaterThan(0);

    // Duration chain: all spans should have positive duration
    for (const span of collected) {
      expect(span.durationMs).toBeTypeOf('number');
      expect(span.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('handles partial failure — tool error does not break trace', async () => {
    const { tracer, collected, collector } = setup();

    const failingTool = instrumentToolCall(tracer, {
      toolId: 'broken',
      toolName: 'Broken Tool',
      fn: async () => {
        throw new Error('segfault');
      },
    });

    const safeTool = instrumentToolCall(tracer, {
      toolId: 'safe',
      toolName: 'Safe Tool',
      fn: async () => 'ok',
    });

    await tracer.withSpan('agent:resilient', 'agent', async () => {
      // First tool fails
      try {
        await failingTool('input');
      } catch {
        // swallow
      }
      // Second tool succeeds
      await safeTool('input');
    });

    await collector.flush();

    expect(collected).toHaveLength(3);

    const brokenSpan = collected.find((s) => s.attributes['tool.name'] === 'Broken Tool')!;
    expect(brokenSpan.status).toBe('error');
    expect(brokenSpan.attributes['tool.error']).toBe('segfault');

    const safeSpan = collected.find((s) => s.attributes['tool.name'] === 'Safe Tool')!;
    expect(safeSpan.status).toBe('ok');
    expect(safeSpan.attributes['tool.output']).toBe('ok');

    // Agent span should still be 'ok' since it caught the error
    const agentSpan = collected.find((s) => s.kind === 'agent')!;
    expect(agentSpan.status).toBe('ok');
  });
});
