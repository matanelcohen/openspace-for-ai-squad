import { describe, expect, it, vi } from 'vitest';

import { runWithContext } from '../span-context.js';
import { TraceCollector } from '../trace-collector.js';
import { Tracer } from '../tracer.js';
import type { Span, SpanContext } from '../types.js';

// ── Helpers ───────────────────────────────────────────────────────

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

// ── Edge Case Tests ──────────────────────────────────────────────

describe('Tracer — edge cases', () => {
  describe('failed spans', () => {
    it('records error status and exception event on throw', async () => {
      const collected: Span[] = [];
      const { tracer, collector } = makeTracer(collected);

      await expect(
        tracer.withSpan('failing-op', 'tool', async () => {
          throw new Error('connection timeout');
        }),
      ).rejects.toThrow('connection timeout');

      await collector.flush();
      expect(collected).toHaveLength(1);
      const span = collected[0]!;
      expect(span.status).toBe('error');
      expect(span.events).toHaveLength(1);
      expect(span.events[0]!.name).toBe('exception');
      expect(span.events[0]!.attributes?.['exception.message']).toBe('connection timeout');
    });

    it('records non-Error thrown values as strings', async () => {
      const collected: Span[] = [];
      const { tracer, collector } = makeTracer(collected);

      await expect(
        tracer.withSpan('string-throw', 'internal', async () => {
          throw 'raw string error';
        }),
      ).rejects.toThrow('raw string error');

      await collector.flush();
      const span = collected[0]!;
      expect(span.events[0]!.attributes?.['exception.message']).toBe('raw string error');
    });

    it('handles thrown undefined/null gracefully', async () => {
      const collected: Span[] = [];
      const { tracer, collector } = makeTracer(collected);

      try {
        await tracer.withSpan('null-throw', 'internal', async () => {
          throw null;
        });
      } catch {
        // expected
      }

      await collector.flush();
      const span = collected[0]!;
      expect(span.status).toBe('error');
      expect(span.events[0]!.attributes?.['exception.message']).toBe('null');
    });
  });

  describe('concurrent traces', () => {
    it('maintains separate trace trees for concurrent operations', async () => {
      const collected: Span[] = [];
      const { tracer, collector } = makeTracer(collected);

      // Run two independent trace trees concurrently
      const [, ] = await Promise.all([
        tracer.withSpan('agent-A', 'agent', async (ctxA) => {
          await tracer.withSpan('tool-A1', 'tool', async (ctxA1) => {
            expect(ctxA1.traceId).toBe(ctxA.traceId);
            // Simulate async work
            await new Promise((r) => setTimeout(r, 10));
          });
        }),
        tracer.withSpan('agent-B', 'agent', async (ctxB) => {
          await tracer.withSpan('tool-B1', 'tool', async (ctxB1) => {
            expect(ctxB1.traceId).toBe(ctxB.traceId);
            await new Promise((r) => setTimeout(r, 10));
          });
        }),
      ]);

      await collector.flush();
      expect(collected).toHaveLength(4);

      // Group by traceId — should be exactly 2 distinct traces
      const traceIds = new Set(collected.map((s) => s.context.traceId));
      expect(traceIds.size).toBe(2);

      // Each trace should have 2 spans (agent + tool)
      for (const tid of traceIds) {
        const spans = collected.filter((s) => s.context.traceId === tid);
        expect(spans).toHaveLength(2);
      }
    });

    it('does not leak context between parallel withSpan calls', async () => {
      const collected: Span[] = [];
      const { tracer, collector } = makeTracer(collected);

      const parentIds: (string | undefined)[] = [];

      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          tracer.withSpan(`root-${i}`, 'agent', async (ctx) => {
            // Record that each root span has no parent
            parentIds.push(ctx.parentSpanId);
            await new Promise((r) => setTimeout(r, 5));
          }),
        ),
      );

      await collector.flush();
      expect(collected).toHaveLength(10);
      // All root spans should have no parent
      expect(parentIds.every((p) => p === undefined)).toBe(true);
      // All should have distinct traceIds
      const traceIds = new Set(collected.map((s) => s.context.traceId));
      expect(traceIds.size).toBe(10);
    });
  });

  describe('very deep span trees', () => {
    it('handles 50-level deep nesting without error', async () => {
      const collected: Span[] = [];
      const { tracer, collector } = makeTracer(collected);
      const DEPTH = 50;

      async function nest(depth: number, parentCtx?: SpanContext): Promise<void> {
        await tracer.withSpan(`level-${depth}`, 'internal', async (ctx) => {
          if (depth > 0) {
            await nest(depth - 1, ctx);
          }
        });
      }

      await nest(DEPTH);
      await collector.flush();

      // DEPTH + 1 spans (level-50 down to level-0)
      expect(collected).toHaveLength(DEPTH + 1);

      // All share the same traceId
      const traceIds = new Set(collected.map((s) => s.context.traceId));
      expect(traceIds.size).toBe(1);

      // Verify parent chain: each span's parent should be the span one level above
      // Spans are collected in reverse order (deepest first due to withSpan semantics)
      const bySpanId = new Map(collected.map((s) => [s.context.spanId, s]));
      const root = collected.find((s) => !s.context.parentSpanId);
      expect(root).toBeDefined();
      expect(root!.name).toBe('level-50');

      // Walk the chain from root to deepest
      let current = root!;
      let chainLength = 1;
      while (true) {
        const child = collected.find((s) => s.context.parentSpanId === current.context.spanId);
        if (!child) break;
        chainLength++;
        current = child;
      }
      expect(chainLength).toBe(DEPTH + 1);
      expect(current.name).toBe('level-0');
    });
  });

  describe('missing/invalid data handling', () => {
    it('endSpan returns undefined for already-ended span', () => {
      const { tracer } = makeTracer();
      const ctx = tracer.startSpan('one-shot');
      tracer.endSpan(ctx.spanId);
      // Second endSpan should return undefined
      expect(tracer.endSpan(ctx.spanId)).toBeUndefined();
    });

    it('recordEvent is a no-op for unknown spanId', () => {
      const { tracer } = makeTracer();
      // Should not throw
      tracer.recordEvent('nonexistent', 'ghost-event', { foo: 'bar' });
    });

    it('setAttributes is a no-op for unknown spanId', () => {
      const { tracer } = makeTracer();
      // Should not throw
      tracer.setAttributes('nonexistent', { key: 'value' });
    });

    it('recordEvent is a no-op after span is ended', () => {
      const { tracer } = makeTracer();
      const ctx = tracer.startSpan('short-lived');
      const span = tracer.endSpan(ctx.spanId)!;
      // After ending, recording should be a no-op
      tracer.recordEvent(ctx.spanId, 'late-event');
      // Original span shouldn't be mutated (it's frozen)
      expect(span.events).toHaveLength(0);
    });
  });

  describe('LLM token promotion edge cases', () => {
    it('promotes llm.prompt_tokens and llm.completion_tokens to tokenUsage', () => {
      const { tracer } = makeTracer();
      const ctx = tracer.startSpan('llm-call', 'llm');
      tracer.setAttributes(ctx.spanId, {
        'llm.prompt_tokens': 100,
        'llm.completion_tokens': 50,
      });
      const span = tracer.endSpan(ctx.spanId)!;
      expect(span.tokenUsage).toEqual({
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
    });

    it('does NOT promote if only one token field is set', () => {
      const { tracer } = makeTracer();
      const ctx = tracer.startSpan('partial-llm', 'llm');
      tracer.setAttributes(ctx.spanId, {
        'llm.prompt_tokens': 100,
        // llm.completion_tokens missing
      });
      const span = tracer.endSpan(ctx.spanId)!;
      expect(span.tokenUsage).toBeUndefined();
    });

    it('does NOT promote if token values are non-numeric', () => {
      const { tracer } = makeTracer();
      const ctx = tracer.startSpan('bad-tokens', 'llm');
      tracer.setAttributes(ctx.spanId, {
        'llm.prompt_tokens': 'one hundred' as unknown as number,
        'llm.completion_tokens': 50,
      });
      const span = tracer.endSpan(ctx.spanId)!;
      expect(span.tokenUsage).toBeUndefined();
    });

    it('promotes llm.cost_usd to costUsd field', () => {
      const { tracer } = makeTracer();
      const ctx = tracer.startSpan('costly-llm', 'llm');
      tracer.setAttributes(ctx.spanId, { 'llm.cost_usd': 0.0042 });
      const span = tracer.endSpan(ctx.spanId)!;
      expect(span.costUsd).toBe(0.0042);
    });

    it('does NOT promote cost if non-numeric', () => {
      const { tracer } = makeTracer();
      const ctx = tracer.startSpan('bad-cost', 'llm');
      tracer.setAttributes(ctx.spanId, { 'llm.cost_usd': 'expensive' });
      const span = tracer.endSpan(ctx.spanId)!;
      expect(span.costUsd).toBeUndefined();
    });

    it('handles zero tokens correctly', () => {
      const { tracer } = makeTracer();
      const ctx = tracer.startSpan('zero-tokens', 'llm');
      tracer.setAttributes(ctx.spanId, {
        'llm.prompt_tokens': 0,
        'llm.completion_tokens': 0,
      });
      const span = tracer.endSpan(ctx.spanId)!;
      expect(span.tokenUsage).toEqual({
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      });
    });
  });

  describe('span timing', () => {
    it('endTime is >= startTime', async () => {
      const { tracer } = makeTracer();
      const ctx = tracer.startSpan('timed-span');
      await new Promise((r) => setTimeout(r, 10));
      const span = tracer.endSpan(ctx.spanId)!;
      expect(span.endTime).toBeGreaterThanOrEqual(span.startTime);
      expect(span.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('durationMs is computed as endTime - startTime', () => {
      const { tracer } = makeTracer();
      const ctx = tracer.startSpan('duration-test');
      const span = tracer.endSpan(ctx.spanId)!;
      expect(span.durationMs).toBe(span.endTime! - span.startTime);
    });
  });

  describe('context propagation via runWithContext', () => {
    it('withSpan inherits parent context from manual runWithContext', async () => {
      const collected: Span[] = [];
      const { tracer, collector } = makeTracer(collected);

      const parentCtx: SpanContext = {
        traceId: 'manual-trace-id',
        spanId: 'manual-span-id',
      };

      await runWithContext(parentCtx, async () => {
        await tracer.withSpan('child-in-manual-ctx', 'internal', async (ctx) => {
          expect(ctx.traceId).toBe('manual-trace-id');
          expect(ctx.parentSpanId).toBe('manual-span-id');
        });
      });

      await collector.flush();
      expect(collected).toHaveLength(1);
      expect(collected[0]!.context.traceId).toBe('manual-trace-id');
      expect(collected[0]!.context.parentSpanId).toBe('manual-span-id');
    });
  });
});
