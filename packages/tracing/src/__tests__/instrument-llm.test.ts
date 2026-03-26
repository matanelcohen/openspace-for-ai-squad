import { describe, expect, it } from 'vitest';

import { instrumentLLMCall } from '../instrument-llm.js';
import { TraceCollector } from '../trace-collector.js';
import { Tracer } from '../tracer.js';
import type { ModelPriceTable, Span } from '../types.js';

describe('instrumentLLMCall', () => {
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

  const priceTable: ModelPriceTable = [
    { model: 'gpt-4o', promptPricePer1k: 0.005, completionPricePer1k: 0.015 },
  ];

  it('captures model, tokens, and cost', async () => {
    const { tracer, collected, collector } = setup();

    interface LLMResponse {
      text: string;
      usage: { prompt_tokens: number; completion_tokens: number };
    }

    const traced = instrumentLLMCall(
      tracer,
      {
        model: 'gpt-4o',
        provider: 'openai',
        fn: async (prompt: string): Promise<LLMResponse> => ({
          text: `response to ${prompt}`,
          usage: { prompt_tokens: 100, completion_tokens: 50 },
        }),
        extractUsage: (res) => ({
          promptTokens: res.usage.prompt_tokens,
          completionTokens: res.usage.completion_tokens,
        }),
      },
      priceTable,
    );

    const result = await traced('hello');
    await collector.flush();

    expect(result.text).toBe('response to hello');
    expect(collected).toHaveLength(1);

    const span = collected[0]!;
    expect(span.name).toBe('llm:gpt-4o');
    expect(span.kind).toBe('llm');
    expect(span.status).toBe('ok');
    expect(span.attributes['llm.model']).toBe('gpt-4o');
    expect(span.attributes['llm.provider']).toBe('openai');
    expect(span.attributes['llm.prompt_tokens']).toBe(100);
    expect(span.attributes['llm.completion_tokens']).toBe(50);
    expect(span.attributes['llm.total_tokens']).toBe(150);
    expect(span.attributes['llm.cost_usd']).toBe(0.00125);
    expect(span.attributes['llm.total_duration_ms']).toBeTypeOf('number');
  });

  it('works without extractUsage (no token tracking)', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentLLMCall(tracer, {
      model: 'custom-model',
      fn: async (prompt: string) => `echo: ${prompt}`,
    });

    const result = await traced('test');
    await collector.flush();

    expect(result).toBe('echo: test');
    expect(collected[0]!.attributes['llm.prompt_tokens']).toBeUndefined();
    expect(collected[0]!.attributes['llm.cost_usd']).toBeUndefined();
  });

  it('records streaming event', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentLLMCall(tracer, {
      model: 'gpt-4o',
      streaming: true,
      fn: async () => 'streamed result',
    });

    await traced('prompt');
    await collector.flush();

    const span = collected[0]!;
    expect(span.attributes['llm.streaming']).toBe(true);
    expect(span.events.some((e) => e.name === 'llm.stream.start')).toBe(true);
  });

  it('captures errors from LLM calls', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentLLMCall(tracer, {
      model: 'gpt-4o',
      fn: async () => {
        throw new Error('rate limited');
      },
    });

    await expect(traced('prompt')).rejects.toThrow('rate limited');
    await collector.flush();

    expect(collected[0]!.status).toBe('error');
  });

  it('forms proper tree when nested under agent span', async () => {
    const { tracer, collected, collector } = setup();

    const traced = instrumentLLMCall(tracer, {
      model: 'gpt-4o',
      fn: async (p: string) => `reply:${p}`,
    });

    await tracer.withSpan('reasoning', 'reasoning', async (parentCtx) => {
      await traced('think');

      await collector.flush();
      const llmSpan = collected.find((s) => s.kind === 'llm')!;
      expect(llmSpan.context.traceId).toBe(parentCtx.traceId);
      expect(llmSpan.context.parentSpanId).toBe(parentCtx.spanId);
    });
  });
});
