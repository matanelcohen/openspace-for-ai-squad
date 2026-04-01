import type { SpanRecord } from '../services/traces/index.js';
import { buildSpanTree, makePreview } from './traces.js';

// ── makePreview ───────────────────────────────────────────────────

describe('makePreview', () => {
  it('returns null for null input', () => {
    expect(makePreview(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(makePreview(undefined)).toBeNull();
  });

  it('returns short strings as-is', () => {
    expect(makePreview('hello world')).toBe('hello world');
  });

  it('truncates long strings with "..."', () => {
    const long = 'a'.repeat(200);
    const result = makePreview(long);
    expect(result).toHaveLength(123); // 120 + "..."
    expect(result!.endsWith('...')).toBe(true);
  });

  it('JSON-stringifies objects and truncates', () => {
    const obj = { key: 'x'.repeat(200) };
    const result = makePreview(obj)!;
    expect(result.length).toBeLessThanOrEqual(123);
    expect(result.endsWith('...')).toBe(true);
    expect(result).toContain('"key"');
  });

  it('returns stringified object when short', () => {
    expect(makePreview({ a: 1 })).toBe('{"a":1}');
  });
});

// ── buildSpanTree — tool name override ────────────────────────────

function makeSpan(overrides: Partial<SpanRecord>): SpanRecord {
  return {
    id: 'span-1',
    trace_id: 'trace-1',
    parent_span_id: null,
    name: 'default',
    kind: 'tool',
    status: 'completed',
    start_time: Date.now(),
    end_time: Date.now() + 100,
    duration_ms: 100,
    attributes: '{}',
    events: '[]',
    ...overrides,
  };
}

describe('buildSpanTree — tool name override', () => {
  it('overrides "tool" span name with tool.name attr', () => {
    const spans = [
      makeSpan({
        name: 'tool',
        kind: 'tool',
        attributes: JSON.stringify({ 'tool.name': 'web_search' }),
      }),
    ];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.name).toBe('web_search');
  });

  it('overrides "tool-call" span name with tool.name attr', () => {
    const spans = [
      makeSpan({
        name: 'tool-call',
        kind: 'tool',
        attributes: JSON.stringify({ 'tool.name': 'code_interpreter' }),
      }),
    ];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.name).toBe('code_interpreter');
  });

  it('keeps specific tool span name even when tool.name attr exists', () => {
    const spans = [
      makeSpan({
        name: 'my-custom-tool',
        kind: 'tool',
        attributes: JSON.stringify({ 'tool.name': 'web_search' }),
      }),
    ];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.name).toBe('my-custom-tool');
  });

  it('never overrides name for non-tool spans', () => {
    const spans = [
      makeSpan({
        name: 'tool',
        kind: 'llm',
        attributes: JSON.stringify({ 'tool.name': 'web_search' }),
      }),
    ];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.name).toBe('tool');
  });
});

// ── buildSpanTree — new SpanResponse fields ───────────────────────

describe('buildSpanTree — SpanResponse fields', () => {
  it('populates toolName for tool spans', () => {
    const spans = [
      makeSpan({
        kind: 'tool',
        attributes: JSON.stringify({ 'tool.name': 'web_search' }),
      }),
    ];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.toolName).toBe('web_search');
    expect(root.provider).toBeNull();
  });

  it('populates provider for llm spans', () => {
    const spans = [
      makeSpan({
        kind: 'llm',
        attributes: JSON.stringify({ 'llm.provider': 'openai', 'llm.model': 'gpt-4o' }),
      }),
    ];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.provider).toBe('openai');
    expect(root.toolName).toBeNull();
    expect(root.model).toBe('gpt-4o');
  });

  it('sets inputPreview and outputPreview as truncated strings', () => {
    const longInput = 'a'.repeat(200);
    const spans = [
      makeSpan({
        kind: 'tool',
        attributes: JSON.stringify({
          'tool.name': 'search',
          'tool.input': longInput,
          'tool.output': 'short result',
        }),
      }),
    ];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.inputPreview).not.toBeNull();
    expect(root.inputPreview!.length).toBeLessThanOrEqual(123);
    expect(root.outputPreview).toBe('short result');
  });

  it('sets null previews when no input/output', () => {
    const spans = [makeSpan({ kind: 'internal', attributes: '{}' })];
    const [root] = buildSpanTree(spans, 'completed');
    expect(root.inputPreview).toBeNull();
    expect(root.outputPreview).toBeNull();
  });
});
