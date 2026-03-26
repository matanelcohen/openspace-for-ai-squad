import { describe, expect, it } from 'vitest';

import {
  aggregateCost,
  aggregateTokenUsage,
  buildTrace,
  InMemoryTraceStore,
} from '../trace-store.js';
import type { Run, Span, TokenUsage } from '../types.js';

// ── Helpers ───────────────────────────────────────────────────────

function makeSpan(overrides: Partial<Span> & { spanId: string; traceId: string }): Span {
  return {
    context: {
      traceId: overrides.traceId,
      spanId: overrides.spanId,
      parentSpanId: overrides.context?.parentSpanId,
    },
    name: overrides.name ?? 'test-span',
    kind: overrides.kind ?? 'internal',
    status: overrides.status ?? 'ok',
    startTime: overrides.startTime ?? 1000,
    endTime: overrides.endTime ?? 2000,
    durationMs: overrides.durationMs ?? 1000,
    tokenUsage: overrides.tokenUsage,
    costUsd: overrides.costUsd,
    attributes: overrides.attributes ?? {},
    events: overrides.events ?? [],
  };
}

function makeRun(overrides: Partial<Run> & { runId: string }): Run {
  return {
    runId: overrides.runId,
    agentId: overrides.agentId ?? 'test-agent',
    trigger: overrides.trigger ?? 'user',
    status: overrides.status ?? 'completed',
    startTime: overrides.startTime ?? 1000,
    endTime: overrides.endTime ?? 5000,
    durationMs: overrides.durationMs ?? 4000,
    tokenUsage: overrides.tokenUsage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    totalCostUsd: overrides.totalCostUsd ?? 0,
    spanCount: overrides.spanCount ?? 1,
    errorMessage: overrides.errorMessage,
    metadata: overrides.metadata,
  };
}

// ── aggregateTokenUsage ───────────────────────────────────────────

describe('aggregateTokenUsage', () => {
  it('sums token usage across spans', () => {
    const spans: Span[] = [
      makeSpan({
        spanId: 's1',
        traceId: 't1',
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      }),
      makeSpan({
        spanId: 's2',
        traceId: 't1',
        tokenUsage: { promptTokens: 200, completionTokens: 80, totalTokens: 280 },
      }),
    ];
    const result: TokenUsage = aggregateTokenUsage(spans);
    expect(result).toEqual({ promptTokens: 300, completionTokens: 130, totalTokens: 430 });
  });

  it('returns zeros when no spans have token usage', () => {
    const spans: Span[] = [makeSpan({ spanId: 's1', traceId: 't1' })];
    expect(aggregateTokenUsage(spans)).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });

  it('handles empty span list', () => {
    expect(aggregateTokenUsage([])).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    });
  });
});

// ── aggregateCost ─────────────────────────────────────────────────

describe('aggregateCost', () => {
  it('sums cost across spans', () => {
    const spans: Span[] = [
      makeSpan({ spanId: 's1', traceId: 't1', costUsd: 0.001 }),
      makeSpan({ spanId: 's2', traceId: 't1', costUsd: 0.002 }),
    ];
    expect(aggregateCost(spans)).toBe(0.003);
  });

  it('returns 0 when no spans have cost', () => {
    expect(aggregateCost([makeSpan({ spanId: 's1', traceId: 't1' })])).toBe(0);
  });
});

// ── buildTrace ────────────────────────────────────────────────────

describe('buildTrace', () => {
  it('builds a trace from spans', () => {
    const spans: Span[] = [
      makeSpan({
        spanId: 'root',
        traceId: 't1',
        startTime: 1000,
        endTime: 5000,
        tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        costUsd: 0.01,
      }),
      makeSpan({
        spanId: 'child',
        traceId: 't1',
        context: { traceId: 't1', spanId: 'child', parentSpanId: 'root' },
        startTime: 1500,
        endTime: 3000,
      }),
    ];
    const trace = buildTrace('t1', spans);
    expect(trace).toBeDefined();
    expect(trace!.traceId).toBe('t1');
    expect(trace!.rootSpanId).toBe('root');
    expect(trace!.spans).toHaveLength(2);
    expect(trace!.startTime).toBe(1000);
    expect(trace!.endTime).toBe(5000);
    expect(trace!.durationMs).toBe(4000);
    expect(trace!.tokenUsage.promptTokens).toBe(100);
    expect(trace!.totalCostUsd).toBe(0.01);
  });

  it('returns undefined for empty spans', () => {
    expect(buildTrace('t1', [])).toBeUndefined();
  });

  it('attaches run when provided', () => {
    const span = makeSpan({ spanId: 'root', traceId: 't1' });
    const run = makeRun({ runId: 't1' });
    const trace = buildTrace('t1', [span], run);
    expect(trace!.run).toBe(run);
  });
});

// ── InMemoryTraceStore ────────────────────────────────────────────

describe('InMemoryTraceStore', () => {
  it('appends and retrieves spans as a trace', async () => {
    const store = new InMemoryTraceStore();
    const span = makeSpan({ spanId: 's1', traceId: 'run-1', startTime: 100, endTime: 200 });
    await store.appendSpans([span]);

    const trace = await store.getTrace('run-1');
    expect(trace).toBeDefined();
    expect(trace!.spans).toHaveLength(1);
    expect(trace!.spans[0]!.context.spanId).toBe('s1');
  });

  it('is idempotent on duplicate spanIds', async () => {
    const store = new InMemoryTraceStore();
    const span = makeSpan({ spanId: 's1', traceId: 'run-1' });
    await store.appendSpans([span]);
    await store.appendSpans([span]);

    const trace = await store.getTrace('run-1');
    expect(trace!.spans).toHaveLength(1);
  });

  it('upserts and lists runs', async () => {
    const store = new InMemoryTraceStore();
    const run = makeRun({ runId: 'run-1', agentId: 'agent-a', startTime: 1000 });
    await store.upsertRun(run);

    const runs = await store.listRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]!.runId).toBe('run-1');
  });

  it('filters runs by agentId', async () => {
    const store = new InMemoryTraceStore();
    await store.upsertRun(makeRun({ runId: 'r1', agentId: 'agent-a', startTime: 1000 }));
    await store.upsertRun(makeRun({ runId: 'r2', agentId: 'agent-b', startTime: 2000 }));

    const runs = await store.listRuns({ agentId: 'agent-a' });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.agentId).toBe('agent-a');
  });

  it('filters runs by status', async () => {
    const store = new InMemoryTraceStore();
    await store.upsertRun(makeRun({ runId: 'r1', status: 'completed', startTime: 1000 }));
    await store.upsertRun(makeRun({ runId: 'r2', status: 'failed', startTime: 2000 }));

    const runs = await store.listRuns({ status: 'failed' });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.runId).toBe('r2');
  });

  it('filters runs by time range', async () => {
    const store = new InMemoryTraceStore();
    await store.upsertRun(makeRun({ runId: 'r1', startTime: 1000 }));
    await store.upsertRun(makeRun({ runId: 'r2', startTime: 3000 }));
    await store.upsertRun(makeRun({ runId: 'r3', startTime: 5000 }));

    const runs = await store.listRuns({ startAfter: 1500, startBefore: 4000 });
    expect(runs).toHaveLength(1);
    expect(runs[0]!.runId).toBe('r2');
  });

  it('paginates with limit and offset', async () => {
    const store = new InMemoryTraceStore();
    for (let i = 0; i < 5; i++) {
      await store.upsertRun(makeRun({ runId: `r${i}`, startTime: i * 1000 }));
    }

    const page = await store.listRuns({ limit: 2, offset: 1 });
    expect(page).toHaveLength(2);
    // Most recent first: r4, r3, r2, r1, r0 → offset 1 → r3, r2
    expect(page[0]!.runId).toBe('r3');
    expect(page[1]!.runId).toBe('r2');
  });

  it('prunes runs older than the given time', async () => {
    const store = new InMemoryTraceStore();
    await store.upsertRun(makeRun({ runId: 'old', startTime: 1000 }));
    await store.appendSpans([makeSpan({ spanId: 's-old', traceId: 'old', startTime: 1000 })]);
    await store.upsertRun(makeRun({ runId: 'new', startTime: 5000 }));
    await store.appendSpans([makeSpan({ spanId: 's-new', traceId: 'new', startTime: 5000 })]);

    const pruned = await store.pruneRunsBefore(3000);
    expect(pruned).toBe(1);

    expect(await store.getTrace('old')).toBeUndefined();
    expect(await store.getTrace('new')).toBeDefined();
  });

  it('returns undefined for unknown runId', async () => {
    const store = new InMemoryTraceStore();
    expect(await store.getTrace('does-not-exist')).toBeUndefined();
  });

  it('reports stats correctly', async () => {
    const store = new InMemoryTraceStore();
    expect(store.stats).toEqual({ runCount: 0, spanCount: 0 });

    await store.upsertRun(makeRun({ runId: 'r1' }));
    await store.appendSpans([
      makeSpan({ spanId: 's1', traceId: 'r1' }),
      makeSpan({ spanId: 's2', traceId: 'r1' }),
    ]);
    expect(store.stats).toEqual({ runCount: 1, spanCount: 2 });
  });
});
