import { describe, expect, it } from 'vitest';

import { TraceCollector } from '../trace-collector.js';
import { Tracer } from '../tracer.js';
import type { Span, SpanContext } from '../types.js';

describe('Tracer', () => {
  function makeTracer(spans?: Span[]) {
    const collected: Span[] = spans ?? [];
    const collector = new TraceCollector({
      batchSize: 100,
      flushIntervalMs: 0,
      sink: async (batch) => {
        collected.push(...batch);
      },
    });
    const tracer = new Tracer({ serviceName: 'test-agent', collector });
    return { tracer, collected, collector };
  }

  it('creates a span with traceId and spanId', () => {
    const { tracer } = makeTracer();
    const ctx = tracer.startSpan('test-span', 'internal');

    expect(ctx.traceId).toBeTruthy();
    expect(ctx.spanId).toBeTruthy();
    expect(ctx.parentSpanId).toBeUndefined();
    expect(tracer.getActiveSpanCount()).toBe(1);
  });

  it('endSpan returns a frozen span and submits to collector', async () => {
    const { tracer, collected, collector } = makeTracer();
    const ctx = tracer.startSpan('my-span', 'agent');
    const span = tracer.endSpan(ctx.spanId, 'ok');

    expect(span).toBeDefined();
    expect(span!.name).toBe('my-span');
    expect(span!.kind).toBe('agent');
    expect(span!.status).toBe('ok');
    expect(span!.endTime).toBeGreaterThanOrEqual(span!.startTime);
    expect(span!.attributes['service.name']).toBe('test-agent');
    expect(tracer.getActiveSpanCount()).toBe(0);

    await collector.flush();
    expect(collected).toHaveLength(1);
  });

  it('recordEvent adds event to active span', () => {
    const { tracer } = makeTracer();
    const ctx = tracer.startSpan('event-test');
    tracer.recordEvent(ctx.spanId, 'my-event', { key: 'value' });
    const span = tracer.endSpan(ctx.spanId);

    expect(span!.events).toHaveLength(1);
    expect(span!.events[0]!.name).toBe('my-event');
    expect(span!.events[0]!.attributes).toEqual({ key: 'value' });
  });

  it('setAttributes merges attributes on active span', () => {
    const { tracer } = makeTracer();
    const ctx = tracer.startSpan('attr-test', 'internal', { initial: true });
    tracer.setAttributes(ctx.spanId, { added: 42 });
    const span = tracer.endSpan(ctx.spanId);

    expect(span!.attributes['initial']).toBe(true);
    expect(span!.attributes['added']).toBe(42);
  });

  it('endSpan returns undefined for unknown spanId', () => {
    const { tracer } = makeTracer();
    expect(tracer.endSpan('nonexistent')).toBeUndefined();
  });

  describe('withSpan', () => {
    it('creates and ends a span around async work', async () => {
      const collected: Span[] = [];
      const { tracer, collector } = makeTracer(collected);

      const result = await tracer.withSpan('task', 'agent', async () => {
        return 42;
      });

      expect(result).toBe(42);
      await collector.flush();
      expect(collected).toHaveLength(1);
      expect(collected[0]!.status).toBe('ok');
    });

    it('marks span as error when fn throws', async () => {
      const collected: Span[] = [];
      const { tracer, collector } = makeTracer(collected);

      await expect(
        tracer.withSpan('failing', 'tool', async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');

      await collector.flush();
      expect(collected).toHaveLength(1);
      expect(collected[0]!.status).toBe('error');
      expect(collected[0]!.events[0]!.name).toBe('exception');
    });

    it('propagates context so nested spans share traceId', async () => {
      const collected: Span[] = [];
      const { tracer, collector } = makeTracer(collected);

      await tracer.withSpan('parent', 'agent', async (parentCtx) => {
        await tracer.withSpan('child', 'tool', async (childCtx) => {
          expect(childCtx.traceId).toBe(parentCtx.traceId);
          expect(childCtx.parentSpanId).toBe(parentCtx.spanId);

          await tracer.withSpan('grandchild', 'llm', async (gcCtx) => {
            expect(gcCtx.traceId).toBe(parentCtx.traceId);
            expect(gcCtx.parentSpanId).toBe(childCtx.spanId);
          });
        });
      });

      await collector.flush();
      expect(collected).toHaveLength(3);

      const [grandchild, child, parent] = collected;
      expect(parent!.context.parentSpanId).toBeUndefined();
      expect(child!.context.parentSpanId).toBe(parent!.context.spanId);
      expect(grandchild!.context.parentSpanId).toBe(child!.context.spanId);
    });
  });
});
