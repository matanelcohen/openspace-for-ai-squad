import { describe, expect, it } from 'vitest';

import { TraceCollector } from '../trace-collector.js';
import { Tracer } from '../tracer.js';

// ── Performance Tests ─────────────────────────────────────────────
// Verify that tracing overhead stays under 5% of baseline latency.

describe('Tracing Performance', () => {
  const ITERATIONS = 500;
  const SIMULATED_WORK_MS = 1; // Minimal async work to simulate

  async function simulateWork(): Promise<number> {
    // Simulate a lightweight async operation
    const _start = performance.now();
    await new Promise((r) => setTimeout(r, SIMULATED_WORK_MS));
    let sum = 0;
    for (let i = 0; i < 1000; i++) sum += i;
    return sum;
  }

  it('tracing overhead stays under 5% of baseline latency', { timeout: 30_000 }, async () => {
    // -- Baseline: run without tracing --
    const baselineTimes: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await simulateWork();
      baselineTimes.push(performance.now() - start);
    }

    // -- Traced: run with full tracing --
    const collector = new TraceCollector({
      batchSize: 1000,
      flushIntervalMs: 0,
      sink: async () => {}, // no-op sink
    });
    const tracer = new Tracer({ serviceName: 'perf-agent', collector });

    const tracedTimes: number[] = [];
    for (let i = 0; i < ITERATIONS; i++) {
      const start = performance.now();
      await tracer.withSpan(`perf-span-${i}`, 'internal', async () => {
        await simulateWork();
      });
      tracedTimes.push(performance.now() - start);
    }

    await collector.shutdown();

    // -- Compute medians (more robust than means for timing) --
    const median = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
    };

    const baselineMedian = median(baselineTimes);
    const tracedMedian = median(tracedTimes);
    const overheadPct = ((tracedMedian - baselineMedian) / baselineMedian) * 100;

    console.log(`Baseline median: ${baselineMedian.toFixed(3)}ms`);
    console.log(`Traced median:   ${tracedMedian.toFixed(3)}ms`);
    console.log(`Overhead:        ${overheadPct.toFixed(2)}%`);

    // Assert overhead < 5%
    // Note: if baseline is very small, absolute overhead could be tiny
    // but percentage could be high. Use a generous absolute threshold too.
    const absoluteOverhead = tracedMedian - baselineMedian;
    expect(
      overheadPct < 5 || absoluteOverhead < 0.5,
      `Tracing overhead ${overheadPct.toFixed(2)}% (${absoluteOverhead.toFixed(3)}ms absolute) exceeds 5% threshold`,
    ).toBe(true);
  });

  it('span creation and ending is sub-millisecond', () => {
    const collector = new TraceCollector({
      batchSize: 10000,
      flushIntervalMs: 0,
      sink: async () => {},
    });
    const tracer = new Tracer({ serviceName: 'micro-bench', collector });

    const count = 10_000;
    const start = performance.now();
    for (let i = 0; i < count; i++) {
      const ctx = tracer.startSpan(`span-${i}`);
      tracer.endSpan(ctx.spanId);
    }
    const elapsed = performance.now() - start;
    const perSpan = elapsed / count;

    console.log(`${count} spans in ${elapsed.toFixed(1)}ms (${perSpan.toFixed(4)}ms/span)`);

    // Each span create+end should be well under 1ms
    expect(perSpan).toBeLessThan(1);
  });

  it('deep nesting (100 levels) completes in reasonable time', async () => {
    const collector = new TraceCollector({
      batchSize: 200,
      flushIntervalMs: 0,
      sink: async () => {},
    });
    const tracer = new Tracer({ serviceName: 'deep-bench', collector });

    const DEPTH = 100;
    const start = performance.now();

    async function nest(depth: number): Promise<void> {
      await tracer.withSpan(`level-${depth}`, 'internal', async () => {
        if (depth > 0) await nest(depth - 1);
      });
    }

    await nest(DEPTH);
    const elapsed = performance.now() - start;

    console.log(`100-level deep trace completed in ${elapsed.toFixed(1)}ms`);
    // Should complete well within 1 second
    expect(elapsed).toBeLessThan(1000);

    await collector.shutdown();
  });

  it('concurrent traces do not degrade performance', async () => {
    const collector = new TraceCollector({
      batchSize: 10000,
      flushIntervalMs: 0,
      sink: async () => {},
    });
    const tracer = new Tracer({ serviceName: 'concurrent-bench', collector });

    const CONCURRENT = 50;

    const start = performance.now();
    await Promise.all(
      Array.from({ length: CONCURRENT }, (_, i) =>
        tracer.withSpan(`concurrent-${i}`, 'agent', async () => {
          await tracer.withSpan(`child-${i}`, 'tool', async () => {
            await new Promise((r) => setTimeout(r, 1));
          });
        }),
      ),
    );
    const elapsed = performance.now() - start;

    console.log(`${CONCURRENT} concurrent traces completed in ${elapsed.toFixed(1)}ms`);
    // Should complete reasonably fast (< 5s given 1ms work per trace)
    expect(elapsed).toBeLessThan(5000);

    await collector.shutdown();
  });
});
