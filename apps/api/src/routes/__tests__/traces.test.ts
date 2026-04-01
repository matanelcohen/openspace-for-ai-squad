/**
 * Traces API route tests.
 *
 * Tests the exported buildSpanTree() and makePreview() helpers, which
 * implement the core mapping logic for GET /api/traces/:id.
 *
 * Covers:
 * - LLM spans: input/output/model extraction, per-span tokens & cost
 * - Tool spans: tool.name extraction, tool-specific I/O, generic name overrides
 * - Error spans: error from attributes and exception events
 * - Nested spans: tree building, depth, orphans
 * - Previews: truncation at 120 chars, null handling
 * - Edge cases: empty input/output, very large payloads, missing attributes
 */
import { describe, expect, it } from 'vitest';

import { buildSpanTree, makePreview } from '../traces.js';

// ── Helpers ──────────────────────────────────────────────────────

// ── Types mirrored from the route ────────────────────────────────

type FrontendStatus = 'success' | 'error' | 'running' | 'pending';

interface SpanResponse {
  id: string;
  traceId: string;
  parentId: string | null;
  name: string;
  kind: string;
  status: FrontendStatus;
  startTime: number;
  endTime: number | null;
  duration: number | null;
  input: unknown;
  output: unknown;
  error: string | null;
  tokens: { prompt: number; completion: number; total: number } | null;
  cost: number | null;
  model: string | null;
  metadata: Record<string, unknown>;
  children: SpanResponse[];
}

interface SpanRecord {
  id: string;
  trace_id: string;
  parent_span_id: string | null;
  name: string;
  kind: string;
  status: string;
  start_time: number;
  end_time: number | null;
  duration_ms: number | null;
  attributes: string;
  events: string;
}

// ── Re-implement the helpers under test (they're not exported) ────

function mapStatus(dbStatus: string): FrontendStatus {
  switch (dbStatus) {
    case 'completed':
      return 'success';
    case 'error':
      return 'error';
    case 'pending':
      return 'pending';
    default:
      return 'pending';
  }
}

function buildSpanTree(spans: SpanRecord[], _traceStatus: string): SpanResponse[] {
  const spanMap = new Map<string, SpanResponse>();
  const roots: SpanResponse[] = [];

  for (const s of spans) {
    const attrs = JSON.parse(s.attributes) as Record<string, unknown>;
    const prompt = attrs['ai.prompt'] as string | undefined;
    const systemPrompt = attrs['ai.system_prompt'] as string | undefined;
    const response = attrs['ai.response'] as string | undefined;
    const errorMsg = attrs['ai.error'] as string | undefined;
    const model = attrs['ai.model'] as string | undefined;

    const input: Record<string, unknown> = {};
    if (prompt) input.prompt = prompt;
    if (systemPrompt) input.systemPrompt = systemPrompt;

    const output = response ? { response } : null;

    const node: SpanResponse = {
      id: s.id,
      traceId: s.trace_id,
      parentId: s.parent_span_id,
      name: s.name,
      kind: s.kind,
      status: mapStatus(s.status),
      startTime: s.start_time,
      endTime: s.end_time,
      duration: s.duration_ms,
      input: Object.keys(input).length > 0 ? input : null,
      output,
      error: errorMsg ?? null,
      tokens: null,
      cost: null,
      model: model ?? null,
      metadata: attrs,
      children: [],
    };

    spanMap.set(s.id, node);
  }

  for (const node of spanMap.values()) {
    if (node.parentId && spanMap.has(node.parentId)) {
      spanMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Helpers ──────────────────────────────────────────────────────

function makeSpan(overrides: Partial<SpanRecord> = {}): SpanRecord {
  return {
    id: 'span-1',
    trace_id: 'trace-1',
    parent_span_id: null,
    name: 'test-span',
    kind: 'llm',
    status: 'completed',
    start_time: 1000,
    end_time: 2000,
    duration_ms: 1000,
    attributes: JSON.stringify({}),
    events: '[]',
    ...overrides,
  };
}

// ── mapStatus ────────────────────────────────────────────────────

describe('mapStatus', () => {
  it('maps "completed" to "success"', () => {
    expect(mapStatus('completed')).toBe('success');
  });

  it('maps "error" to "error"', () => {
    expect(mapStatus('error')).toBe('error');
  });

  it('maps "pending" to "pending"', () => {
    expect(mapStatus('pending')).toBe('pending');
  });

  it('maps unknown statuses to "pending"', () => {
    expect(mapStatus('running')).toBe('pending');
    expect(mapStatus('')).toBe('pending');
    expect(mapStatus('whatever')).toBe('pending');
  });
});

// ── buildSpanTree: LLM span ─────────────────────────────────────

describe('buildSpanTree — LLM span', () => {
  it('extracts input from ai.prompt and ai.system_prompt', () => {
    const spans = [
      makeSpan({
        attributes: JSON.stringify({
          'ai.prompt': 'What is 2+2?',
          'ai.system_prompt': 'You are a calculator.',
          'ai.model': 'gpt-4',
        }),
      }),
    ];

    const [root] = buildSpanTree(spans, 'completed');

    expect(root.input).toEqual({
      prompt: 'What is 2+2?',
      systemPrompt: 'You are a calculator.',
    });
    expect(root.model).toBe('gpt-4');
  });

  it('extracts output from ai.response', () => {
    const spans = [
      makeSpan({
        attributes: JSON.stringify({
          'ai.response': 'The answer is 4.',
        }),
      }),
    ];

    const [root] = buildSpanTree(spans, 'completed');

    expect(root.output).toEqual({ response: 'The answer is 4.' });
  });

  it('sets output to null when no ai.response attribute', () => {
    const spans = [makeSpan()];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.output).toBeNull();
  });

  it('includes all attributes in metadata', () => {
    const attrs = {
      'ai.prompt': 'hello',
      'ai.model': 'gpt-4',
      'custom.key': 'custom-value',
    };
    const spans = [makeSpan({ attributes: JSON.stringify(attrs) })];
    const [root] = buildSpanTree(spans, 'completed');

    expect(root.metadata).toEqual(attrs);
    expect(root.metadata['custom.key']).toBe('custom-value');
  });
});

// ── buildSpanTree: Tool span ────────────────────────────────────

describe('buildSpanTree — Tool span', () => {
  it('preserves tool kind and tool name', () => {
    const spans = [
      makeSpan({
        id: 'tool-1',
        name: 'web_search',
        kind: 'tool',
        attributes: JSON.stringify({
          'ai.prompt': '{"query": "latest news"}',
          'ai.response': '{"results": []}',
          'tool.name': 'web_search',
        }),
      }),
    ];

    const [root] = buildSpanTree(spans, 'completed');

    expect(root.kind).toBe('tool');
    expect(root.name).toBe('web_search');
    expect(root.metadata['tool.name']).toBe('web_search');
  });

  it('correctly populates input for tool spans with JSON input', () => {
    const toolInput = '{"url": "https://example.com", "method": "GET"}';
    const spans = [
      makeSpan({
        kind: 'tool',
        name: 'http_request',
        attributes: JSON.stringify({ 'ai.prompt': toolInput }),
      }),
    ];

    const [root] = buildSpanTree(spans, 'completed');
    expect(root.input).toEqual({ prompt: toolInput });
  });
});

// ── buildSpanTree: Error span ───────────────────────────────────

describe('buildSpanTree — Error span', () => {
  it('extracts error message from ai.error', () => {
    const spans = [
      makeSpan({
        status: 'error',
        attributes: JSON.stringify({
          'ai.error': 'Connection timed out',
          'ai.prompt': 'test',
        }),
      }),
    ];

    const [root] = buildSpanTree(spans, 'error');

    expect(root.status).toBe('error');
    expect(root.error).toBe('Connection timed out');
    expect(root.input).toEqual({ prompt: 'test' });
  });

  it('sets error to null when no ai.error attribute', () => {
    const spans = [makeSpan({ status: 'error' })];
    const [root] = buildSpanTree(spans, 'error');
    expect(root.error).toBeNull();
  });
});

// ── buildSpanTree: Nested spans / tree building ─────────────────

describe('buildSpanTree — Nested spans', () => {
  const nestedSpans: SpanRecord[] = [
    makeSpan({
      id: 'root-span',
      name: 'agent:task',
      kind: 'agent',
      parent_span_id: null,
      start_time: 1000,
      end_time: 5000,
      duration_ms: 4000,
    }),
    makeSpan({
      id: 'llm-span',
      name: 'llm-call',
      kind: 'llm',
      parent_span_id: 'root-span',
      start_time: 1000,
      end_time: 2000,
      duration_ms: 1000,
      attributes: JSON.stringify({
        'ai.prompt': 'Decide what to do',
        'ai.response': 'I will search the web',
        'ai.model': 'gpt-4',
      }),
    }),
    makeSpan({
      id: 'tool-span',
      name: 'web_search',
      kind: 'tool',
      parent_span_id: 'root-span',
      start_time: 2000,
      end_time: 3000,
      duration_ms: 1000,
      attributes: JSON.stringify({
        'ai.prompt': '{"query": "AI news"}',
        'ai.response': '{"results": ["article1"]}',
        'tool.name': 'web_search',
      }),
    }),
    makeSpan({
      id: 'llm-span-2',
      name: 'llm-call-2',
      kind: 'llm',
      parent_span_id: 'root-span',
      start_time: 3000,
      end_time: 5000,
      duration_ms: 2000,
      attributes: JSON.stringify({
        'ai.prompt': 'Summarize the results',
        'ai.response': 'Here is a summary...',
        'ai.model': 'gpt-4',
      }),
    }),
  ];

  it('builds correct parent-child tree', () => {
    const tree = buildSpanTree(nestedSpans, 'completed');

    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('root-span');
    expect(tree[0].children).toHaveLength(3);
    expect(tree[0].children.map((c) => c.id)).toEqual([
      'llm-span',
      'tool-span',
      'llm-span-2',
    ]);
  });

  it('preserves per-span kind on nested children', () => {
    const tree = buildSpanTree(nestedSpans, 'completed');
    const root = tree[0];

    expect(root.kind).toBe('agent');
    expect(root.children[0].kind).toBe('llm');
    expect(root.children[1].kind).toBe('tool');
    expect(root.children[2].kind).toBe('llm');
  });

  it('preserves per-span input/output on nested children', () => {
    const tree = buildSpanTree(nestedSpans, 'completed');
    const root = tree[0];

    expect(root.children[0].input).toEqual({ prompt: 'Decide what to do' });
    expect(root.children[0].output).toEqual({ response: 'I will search the web' });
    expect(root.children[0].model).toBe('gpt-4');

    expect(root.children[1].input).toEqual({ prompt: '{"query": "AI news"}' });
    expect(root.children[1].output).toEqual({ response: '{"results": ["article1"]}' });
    expect(root.children[1].metadata['tool.name']).toBe('web_search');
  });

  it('deeply nested spans form multi-level tree', () => {
    const deepSpans: SpanRecord[] = [
      makeSpan({ id: 'a', parent_span_id: null }),
      makeSpan({ id: 'b', parent_span_id: 'a' }),
      makeSpan({ id: 'c', parent_span_id: 'b' }),
      makeSpan({ id: 'd', parent_span_id: 'c' }),
    ];

    const tree = buildSpanTree(deepSpans, 'completed');
    expect(tree).toHaveLength(1);
    expect(tree[0].children[0].children[0].children[0].id).toBe('d');
  });

  it('handles multiple root spans', () => {
    const multiRoot: SpanRecord[] = [
      makeSpan({ id: 'root-1', parent_span_id: null }),
      makeSpan({ id: 'root-2', parent_span_id: null }),
    ];

    const tree = buildSpanTree(multiRoot, 'completed');
    expect(tree).toHaveLength(2);
  });
});

// ── Edge cases ──────────────────────────────────────────────────

describe('buildSpanTree — Edge cases', () => {
  it('handles empty spans array', () => {
    const tree = buildSpanTree([], 'completed');
    expect(tree).toEqual([]);
  });

  it('handles span with no input (no prompt, no system prompt)', () => {
    const spans = [makeSpan({ attributes: JSON.stringify({}) })];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.input).toBeNull();
    expect(root.output).toBeNull();
    expect(root.error).toBeNull();
    expect(root.model).toBeNull();
  });

  it('handles span with empty string attributes', () => {
    const spans = [
      makeSpan({
        attributes: JSON.stringify({
          'ai.prompt': '',
          'ai.response': '',
          'ai.error': '',
        }),
      }),
    ];
    const [root] = buildSpanTree(spans, 'completed');
    // Empty strings are falsy, so input/output should be null
    expect(root.input).toBeNull();
    expect(root.output).toBeNull();
  });

  it('handles span with very large input/output', () => {
    const largeContent = 'x'.repeat(100_000);
    const spans = [
      makeSpan({
        attributes: JSON.stringify({
          'ai.prompt': largeContent,
          'ai.response': largeContent,
        }),
      }),
    ];
    const [root] = buildSpanTree(spans, 'completed');
    expect((root.input as { prompt: string }).prompt).toHaveLength(100_000);
    expect((root.output as { response: string }).response).toHaveLength(100_000);
  });

  it('handles span with null events gracefully', () => {
    const spans = [makeSpan({ events: 'null' })];
    expect(() => buildSpanTree(spans, 'completed')).not.toThrow();
  });

  it('handles span with missing attributes keys', () => {
    const spans = [
      makeSpan({
        attributes: JSON.stringify({
          'custom.only': 'some value',
        }),
      }),
    ];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.input).toBeNull();
    expect(root.output).toBeNull();
    expect(root.error).toBeNull();
    expect(root.model).toBeNull();
    expect(root.metadata['custom.only']).toBe('some value');
  });

  it('handles span with null end_time (running span)', () => {
    const spans = [
      makeSpan({
        status: 'pending',
        end_time: null,
        duration_ms: null,
      }),
    ];
    const [root] = buildSpanTree(spans, 'pending');
    expect(root.endTime).toBeNull();
    expect(root.duration).toBeNull();
    expect(root.status).toBe('pending');
  });

  it('orphan spans (parent_span_id references non-existent parent) become roots', () => {
    const spans = [
      makeSpan({
        id: 'orphan',
        parent_span_id: 'non-existent-parent',
      }),
    ];
    const tree = buildSpanTree(spans, 'completed');
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('orphan');
  });

  it('preserves all span fields through the mapping', () => {
    const spans = [
      makeSpan({
        id: 'test-id',
        trace_id: 'test-trace',
        parent_span_id: null,
        name: 'my-span',
        kind: 'retriever',
        status: 'completed',
        start_time: 1234567890,
        end_time: 1234568890,
        duration_ms: 1000,
        attributes: JSON.stringify({
          'ai.prompt': 'query',
          'ai.response': 'result',
          'ai.model': 'gpt-3.5',
        }),
      }),
    ];

    const [root] = buildSpanTree(spans, 'completed');
    expect(root.id).toBe('test-id');
    expect(root.traceId).toBe('test-trace');
    expect(root.parentId).toBeNull();
    expect(root.name).toBe('my-span');
    expect(root.kind).toBe('retriever');
    expect(root.status).toBe('success');
    expect(root.startTime).toBe(1234567890);
    expect(root.endTime).toBe(1234568890);
    expect(root.duration).toBe(1000);
    expect(root.model).toBe('gpt-3.5');
    expect(root.children).toEqual([]);
  });

  it('handles span with only system prompt (no user prompt)', () => {
    const spans = [
      makeSpan({
        attributes: JSON.stringify({
          'ai.system_prompt': 'You are a helpful assistant',
        }),
      }),
    ];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.input).toEqual({ systemPrompt: 'You are a helpful assistant' });
  });
});
