import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { Span } from '@/lib/trace-types';

import { formatTokenCount, SpanSubtitle } from '../trace-detail';

afterEach(() => cleanup());

// ── formatTokenCount ──────────────────────────────────────────────

describe('formatTokenCount', () => {
  it('returns plain number below 1000', () => {
    expect(formatTokenCount(500)).toBe('500');
  });

  it('formats 1000 as "1.0k"', () => {
    expect(formatTokenCount(1000)).toBe('1.0k');
  });

  it('formats 2500 as "2.5k"', () => {
    expect(formatTokenCount(2500)).toBe('2.5k');
  });
});

// ── SpanSubtitle ──────────────────────────────────────────────────

function makeSpan(overrides: Partial<Span>): Span {
  return {
    id: 's1',
    traceId: 't1',
    parentId: null,
    name: 'test',
    kind: 'internal',
    status: 'success',
    startTime: Date.now(),
    endTime: Date.now() + 100,
    duration: 100,
    input: null,
    output: null,
    error: null,
    errorStack: null,
    tokens: null,
    cost: null,
    model: null,
    toolName: null,
    toolId: null,
    provider: null,
    timeToFirstToken: null,
    streaming: null,
    inputPreview: null,
    outputPreview: null,
    inputBytes: null,
    outputBytes: null,
    events: [],
    metadata: {},
    children: [],
    ...overrides,
  };
}

describe('SpanSubtitle', () => {
  it('renders tool span with input and output previews separated by →', () => {
    const span = makeSpan({
      kind: 'tool',
      inputPreview: 'search query',
      outputPreview: '3 results',
    });
    render(<SpanSubtitle span={span} />);
    expect(screen.getByText('search query')).toBeInTheDocument();
    expect(screen.getByText('→')).toBeInTheDocument();
    expect(screen.getByText('3 results')).toBeInTheDocument();
  });

  it('renders llm span with model, tokens, and cost', () => {
    const span = makeSpan({
      kind: 'llm',
      model: 'gpt-4o',
      tokens: { prompt: 500, completion: 500, total: 1000 },
      cost: 0.0123,
    });
    render(<SpanSubtitle span={span} />);
    expect(screen.getByText('gpt-4o · 1.0k tokens · $0.0123')).toBeInTheDocument();
  });

  it('renders chain span with child count', () => {
    const child = makeSpan({ id: 'c1' });
    const span = makeSpan({ kind: 'chain', children: [child, { ...child, id: 'c2' }] });
    render(<SpanSubtitle span={span} />);
    expect(screen.getByText('2 steps')).toBeInTheDocument();
  });

  it('renders agent span with inputPreview', () => {
    const span = makeSpan({ kind: 'agent', inputPreview: 'Summarize document' });
    render(<SpanSubtitle span={span} />);
    expect(screen.getByText('Summarize document')).toBeInTheDocument();
  });

  it('renders nothing when no preview data', () => {
    const span = makeSpan({ kind: 'tool' });
    const { container } = render(<SpanSubtitle span={span} />);
    expect(container.innerHTML).toBe('');
  });
});
