import { afterEach, describe, expect, it, vi } from 'vitest';

import { TraceCollector } from '../trace-collector.js';
import type { Span, SpanContext } from '../types.js';

function fakeSpan(overrides?: Partial<Span>): Span {
  const ctx: SpanContext = {
    traceId: 'trace-1',
    spanId: `span-${Math.random().toString(36).slice(2, 8)}`,
  };
  return {
    context: ctx,
    name: 'test',
    kind: 'internal',
    status: 'ok',
    startTime: Date.now(),
    endTime: Date.now(),
    attributes: {},
    events: [],
    ...overrides,
  };
}

describe('TraceCollector', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('flushes when batch size is reached', async () => {
    const flushed: Span[][] = [];
    const collector = new TraceCollector({
      batchSize: 2,
      flushIntervalMs: 0,
      sink: async (batch) => {
        flushed.push([...batch]);
      },
    });

    collector.submit(fakeSpan());
    expect(flushed).toHaveLength(0);

    collector.submit(fakeSpan());
    // Flush is async, give it a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(2);

    await collector.shutdown();
  });

  it('flush() sends all buffered spans', async () => {
    const flushed: Span[][] = [];
    const collector = new TraceCollector({
      batchSize: 100,
      flushIntervalMs: 0,
      sink: async (batch) => {
        flushed.push([...batch]);
      },
    });

    collector.submit(fakeSpan());
    collector.submit(fakeSpan());
    collector.submit(fakeSpan());

    await collector.flush();
    expect(flushed).toHaveLength(1);
    expect(flushed[0]).toHaveLength(3);
    expect(collector.pendingCount).toBe(0);
    expect(collector.totalFlushed).toBe(3);

    await collector.shutdown();
  });

  it('flush() is a no-op when buffer is empty', async () => {
    const sinkCalls: number[] = [];
    const collector = new TraceCollector({
      batchSize: 100,
      flushIntervalMs: 0,
      sink: async () => {
        sinkCalls.push(1);
      },
    });

    await collector.flush();
    expect(sinkCalls).toHaveLength(0);

    await collector.shutdown();
  });

  it('puts spans back on sink failure', async () => {
    let callCount = 0;
    const collector = new TraceCollector({
      batchSize: 100,
      flushIntervalMs: 0,
      sink: async () => {
        callCount++;
        if (callCount === 1) throw new Error('network error');
      },
    });

    collector.submit(fakeSpan());
    collector.submit(fakeSpan());

    await collector.flush();
    expect(collector.pendingCount).toBe(2); // Spans put back

    // Retry succeeds
    await collector.flush();
    expect(collector.pendingCount).toBe(0);
    expect(collector.totalFlushed).toBe(2);

    await collector.shutdown();
  });

  it('shutdown stops the timer and flushes', async () => {
    const flushed: Span[][] = [];
    const collector = new TraceCollector({
      batchSize: 100,
      flushIntervalMs: 60_000, // long interval
      sink: async (batch) => {
        flushed.push([...batch]);
      },
    });

    collector.submit(fakeSpan());
    await collector.shutdown();
    expect(flushed).toHaveLength(1);
  });
});
