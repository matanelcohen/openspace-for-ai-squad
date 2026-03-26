import { describe, expect, it } from 'vitest';

import { spansToSteps, spanToStep } from '../span-to-step.js';
import type { Span } from '../types.js';

function makeSpan(overrides: Partial<Span> & { spanId: string; traceId: string }): Span {
  return {
    context: {
      traceId: overrides.traceId,
      spanId: overrides.spanId,
      parentSpanId: overrides.context?.parentSpanId,
    },
    name: overrides.name ?? 'test',
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

describe('spanToStep', () => {
  it('maps span kind to step type', () => {
    const llmSpan = makeSpan({ spanId: 's1', traceId: 't1', kind: 'llm', name: 'llm:gpt-4o' });
    const step = spanToStep(llmSpan, 't1');
    expect(step.type).toBe('llm-call');
    expect(step.stepId).toBe('s1');
    expect(step.runId).toBe('t1');
    expect(step.name).toBe('llm:gpt-4o');
  });

  it('maps tool kind to tool-call step', () => {
    const toolSpan = makeSpan({
      spanId: 's2',
      traceId: 't1',
      kind: 'tool',
      name: 'tool:search',
      attributes: { 'tool.input': 'query', 'tool.output': 'results' },
    });
    const step = spanToStep(toolSpan, 't1');
    expect(step.type).toBe('tool-call');
    expect(step.input).toBe('query');
    expect(step.output).toBe('results');
  });

  it('extracts error from tool.error attribute', () => {
    const toolSpan = makeSpan({
      spanId: 's3',
      traceId: 't1',
      kind: 'tool',
      status: 'error',
      attributes: { 'tool.error': 'timeout' },
    });
    const step = spanToStep(toolSpan, 't1');
    expect(step.error).toBe('timeout');
    expect(step.status).toBe('error');
  });

  it('extracts error from exception event', () => {
    const span = makeSpan({
      spanId: 's4',
      traceId: 't1',
      status: 'error',
      events: [{ name: 'exception', timestamp: 1500, attributes: { 'exception.message': 'boom' } }],
    });
    const step = spanToStep(span, 't1');
    expect(step.error).toBe('boom');
  });

  it('preserves parent span ID as parent step ID', () => {
    const child = makeSpan({
      spanId: 'child',
      traceId: 't1',
      context: { traceId: 't1', spanId: 'child', parentSpanId: 'parent' },
    });
    const step = spanToStep(child, 't1');
    expect(step.parentStepId).toBe('parent');
  });

  it('includes token usage and cost', () => {
    const span = makeSpan({
      spanId: 's5',
      traceId: 't1',
      kind: 'llm',
      tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      costUsd: 0.005,
    });
    const step = spanToStep(span, 't1');
    expect(step.tokenUsage).toEqual({ promptTokens: 100, completionTokens: 50, totalTokens: 150 });
    expect(step.costUsd).toBe(0.005);
  });
});

describe('spansToSteps', () => {
  it('returns steps sorted by startTime', () => {
    const spans: Span[] = [
      makeSpan({ spanId: 's2', traceId: 't1', startTime: 2000 }),
      makeSpan({ spanId: 's1', traceId: 't1', startTime: 1000 }),
      makeSpan({ spanId: 's3', traceId: 't1', startTime: 3000 }),
    ];
    const steps = spansToSteps(spans, 't1');
    expect(steps.map((s) => s.stepId)).toEqual(['s1', 's2', 's3']);
  });

  it('returns empty array for no spans', () => {
    expect(spansToSteps([], 't1')).toEqual([]);
  });
});
