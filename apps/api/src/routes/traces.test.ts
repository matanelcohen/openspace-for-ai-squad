/**
 * Tests for the enriched buildSpanTree function and trace route helpers.
 *
 * Covers:
 * - Tool span enrichment (toolName, toolId, toolInfo)
 * - Input/output fallback logic
 * - Event parsing
 * - LLM span enrichment (llmInfo: tokensPerSecond, messageCount, responseLength)
 * - Edge cases (empty attributes, missing events, null values)
 * - mapStatus and toTraceSummary helpers
 */

import { describe, expect, it } from 'vitest';

import type { SpanRecord, TraceRecord } from '../services/traces/index.js';
import { buildSpanTree, mapStatus, toTraceSummary } from './traces.js';

// ── Test Helpers ──────────────────────────────────────────────────

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

// ── mapStatus ─────────────────────────────────────────────────────

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

  it('maps unknown status to "pending"', () => {
    expect(mapStatus('in_progress')).toBe('pending');
    expect(mapStatus('')).toBe('pending');
    expect(mapStatus('foobar')).toBe('pending');
  });
});

// ── toTraceSummary ────────────────────────────────────────────────

describe('toTraceSummary', () => {
  it('maps TraceRecord fields to TraceSummaryResponse', () => {
    const row: TraceRecord = {
      id: 't-1',
      root_span_name: 'My Agent Run',
      agent_name: 'bender',
      status: 'completed',
      start_time: 1000,
      end_time: 3000,
      duration_ms: 2000,
      span_count: 5,
      total_tokens: 1500,
      prompt_tokens: 1000,
      completion_tokens: 500,
      cost_usd: 0.05,
      error_message: null,
      created_at: '2026-01-01T00:00:00Z',
    };

    const summary = toTraceSummary(row);
    expect(summary).toEqual({
      id: 't-1',
      name: 'My Agent Run',
      agentName: 'bender',
      status: 'success',
      startTime: 1000,
      duration: 2000,
      totalTokens: 1500,
      totalCost: 0.05,
      spanCount: 5,
      errorCount: 0,
    });
  });

  it('defaults name to "AI Completion" when root_span_name is empty', () => {
    const row: TraceRecord = {
      id: 't-2',
      root_span_name: '',
      agent_name: null,
      status: 'pending',
      start_time: 1000,
      end_time: null,
      duration_ms: null,
      span_count: 1,
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cost_usd: 0,
      error_message: null,
      created_at: '2026-01-01T00:00:00Z',
    };

    const summary = toTraceSummary(row);
    expect(summary.name).toBe('AI Completion');
    expect(summary.agentName).toBe('unknown');
  });

  it('sets errorCount to 1 for error status traces', () => {
    const row: TraceRecord = {
      id: 't-3',
      root_span_name: 'Failed Run',
      agent_name: 'fry',
      status: 'error',
      start_time: 1000,
      end_time: 1500,
      duration_ms: 500,
      span_count: 2,
      total_tokens: 100,
      prompt_tokens: 80,
      completion_tokens: 20,
      cost_usd: 0.001,
      error_message: 'Something broke',
      created_at: '2026-01-01T00:00:00Z',
    };

    expect(toTraceSummary(row).errorCount).toBe(1);
    expect(toTraceSummary(row).status).toBe('error');
  });
});

// ── buildSpanTree: basic structure ────────────────────────────────

describe('buildSpanTree', () => {
  describe('tree structure', () => {
    it('builds a single root node from one span', () => {
      const spans: SpanRecord[] = [makeSpan()];
      const tree = buildSpanTree(spans, 'completed');

      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('span-1');
      expect(tree[0].children).toEqual([]);
    });

    it('builds parent-child relationships', () => {
      const spans: SpanRecord[] = [
        makeSpan({ id: 'root', name: 'root-span' }),
        makeSpan({ id: 'child-1', parent_span_id: 'root', name: 'child-span-1' }),
        makeSpan({ id: 'child-2', parent_span_id: 'root', name: 'child-span-2' }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe('root');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].id).toBe('child-1');
      expect(tree[0].children[1].id).toBe('child-2');
    });

    it('promotes orphan spans as roots', () => {
      const spans: SpanRecord[] = [
        makeSpan({ id: 'orphan-1', parent_span_id: 'missing-parent' }),
        makeSpan({ id: 'orphan-2', parent_span_id: 'also-missing' }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree).toHaveLength(2);
    });

    it('returns empty array for empty spans', () => {
      const tree = buildSpanTree([], 'completed');
      expect(tree).toEqual([]);
    });

    it('maps span fields correctly', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          id: 's1',
          trace_id: 't1',
          parent_span_id: null,
          name: 'Agent Run',
          kind: 'agent',
          status: 'completed',
          start_time: 1000,
          end_time: 3000,
          duration_ms: 2000,
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      const node = tree[0];

      expect(node.id).toBe('s1');
      expect(node.traceId).toBe('t1');
      expect(node.parentId).toBeNull();
      expect(node.name).toBe('Agent Run');
      expect(node.kind).toBe('agent');
      expect(node.status).toBe('success');
      expect(node.startTime).toBe(1000);
      expect(node.endTime).toBe(3000);
      expect(node.duration).toBe(2000);
    });
  });

  // ── Tool span enrichment ──────────────────────────────────────

  describe('tool span enrichment', () => {
    it('extracts toolName and toolId from attributes', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          attributes: JSON.stringify({
            'tool.name': 'search_web',
            'tool.id': 'tool-42',
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].toolName).toBe('search_web');
      expect(tree[0].toolId).toBe('tool-42');
    });

    it('returns null for toolName/toolId when attributes are missing', () => {
      const spans: SpanRecord[] = [makeSpan({ kind: 'tool', attributes: '{}' })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].toolName).toBeNull();
      expect(tree[0].toolId).toBeNull();
    });

    it('returns null for toolName/toolId on non-tool spans', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          attributes: JSON.stringify({ 'ai.model': 'gpt-5.4' }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].toolName).toBeNull();
      expect(tree[0].toolId).toBeNull();
    });

    it('builds toolInfo with parameterCount from tool.input object', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          attributes: JSON.stringify({
            'tool.name': 'calculator',
            'tool.input': { a: 1, b: 2, op: 'add' },
            'tool.output': { result: 3 },
            'tool.duration_ms': 50,
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      const info = tree[0].toolInfo;

      expect(info).not.toBeNull();
      expect(info!.durationMs).toBe(50);
      expect(info!.parameterCount).toBe(3);
      expect(info!.inputBytes).toBeGreaterThan(0);
      expect(info!.outputBytes).toBeGreaterThan(0);
    });

    it('sets parameterCount to null when tool.input is not an object', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          attributes: JSON.stringify({
            'tool.name': 'echo',
            'tool.input': 'hello world',
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].toolInfo!.parameterCount).toBeNull();
    });

    it('sets parameterCount to null when tool.input is an array', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          attributes: JSON.stringify({
            'tool.name': 'batch',
            'tool.input': [1, 2, 3],
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].toolInfo!.parameterCount).toBeNull();
    });

    it('collects custom tool.* attributes in toolInfo.customAttributes', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          attributes: JSON.stringify({
            'tool.name': 'search',
            'tool.id': 't1',
            'tool.input': { query: 'test' },
            'tool.output': { results: [] },
            'tool.provider': 'bing',
            'tool.version': '2.0',
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      const custom = tree[0].toolInfo!.customAttributes;

      expect(custom['tool.provider']).toBe('bing');
      expect(custom['tool.version']).toBe('2.0');
      // Excluded keys should not appear
      expect(custom['tool.name']).toBeUndefined();
      expect(custom['tool.id']).toBeUndefined();
      expect(custom['tool.input']).toBeUndefined();
      expect(custom['tool.output']).toBeUndefined();
    });

    it('sets toolInfo to null for non-tool spans', () => {
      const spans: SpanRecord[] = [makeSpan({ kind: 'llm', attributes: '{}' })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].toolInfo).toBeNull();
    });
  });

  // ── Input/output fallback logic ───────────────────────────────

  describe('input/output fallback logic', () => {
    it('uses ai.prompt and ai.system_prompt as primary input', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          attributes: JSON.stringify({
            'ai.prompt': 'Hello, world',
            'ai.system_prompt': 'You are a helpful assistant',
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      const input = tree[0].input as Record<string, unknown>;
      expect(input.prompt).toBe('Hello, world');
      expect(input.systemPrompt).toBe('You are a helpful assistant');
    });

    it('includes tool.input alongside ai.prompt when both present', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          attributes: JSON.stringify({
            'ai.prompt': 'Run the tool',
            'tool.input': { query: 'test' },
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      const input = tree[0].input as Record<string, unknown>;
      expect(input.prompt).toBe('Run the tool');
      expect(input.toolInput).toEqual({ query: 'test' });
    });

    it('falls back to structured tool info when no ai.prompt for tool spans', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          attributes: JSON.stringify({
            'tool.name': 'search_web',
            'tool.id': 'tool-1',
            'tool.extra_param': 'foo',
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      const input = tree[0].input as Record<string, unknown>;
      expect(input.toolName).toBe('search_web');
      expect(input.toolId).toBe('tool-1');
      expect(input['tool.extra_param']).toBe('foo');
    });

    it('returns null input when no prompt and no tool attributes', () => {
      const spans: SpanRecord[] = [makeSpan({ attributes: '{}' })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].input).toBeNull();
    });

    it('uses ai.response as primary output', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          attributes: JSON.stringify({ 'ai.response': 'The answer is 42' }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      const output = tree[0].output as Record<string, unknown>;
      expect(output.response).toBe('The answer is 42');
    });

    it('falls back to tool.output when ai.response is missing', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          attributes: JSON.stringify({
            'tool.output': { result: 'success', data: [1, 2, 3] },
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      const output = tree[0].output as Record<string, unknown>;
      expect(output.toolOutput).toEqual({ result: 'success', data: [1, 2, 3] });
    });

    it('returns null output when neither ai.response nor tool.output exist', () => {
      const spans: SpanRecord[] = [makeSpan({ attributes: '{}' })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].output).toBeNull();
    });

    it('prefers ai.response over tool.output when both present', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          attributes: JSON.stringify({
            'ai.response': 'AI answer',
            'tool.output': { fallback: true },
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      const output = tree[0].output as Record<string, unknown>;
      expect(output.response).toBe('AI answer');
      expect(output).not.toHaveProperty('toolOutput');
    });
  });

  // ── Error handling ────────────────────────────────────────────

  describe('error handling', () => {
    it('extracts ai.error from attributes', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          status: 'error',
          attributes: JSON.stringify({ 'ai.error': 'Rate limit exceeded' }),
        }),
      ];

      const tree = buildSpanTree(spans, 'error');
      expect(tree[0].error).toBe('Rate limit exceeded');
    });

    it('falls back to tool.error when ai.error is missing', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          status: 'error',
          attributes: JSON.stringify({ 'tool.error': 'Tool timeout' }),
        }),
      ];

      const tree = buildSpanTree(spans, 'error');
      expect(tree[0].error).toBe('Tool timeout');
    });

    it('returns null error when no error attributes present', () => {
      const spans: SpanRecord[] = [makeSpan({ attributes: '{}' })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].error).toBeNull();
    });

    it('prefers ai.error over tool.error', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          status: 'error',
          attributes: JSON.stringify({
            'ai.error': 'AI-level error',
            'tool.error': 'Tool-level error',
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'error');
      expect(tree[0].error).toBe('AI-level error');
    });
  });

  // ── Events parsing ────────────────────────────────────────────

  describe('events parsing', () => {
    it('parses valid events from JSON', () => {
      const evts = [
        { name: 'tool_start', timestamp: 1000, attributes: { tool: 'search' } },
        { name: 'tool_end', timestamp: 2000 },
      ];

      const spans: SpanRecord[] = [makeSpan({ events: JSON.stringify(evts) })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].events).toHaveLength(2);
      expect(tree[0].events[0]).toEqual({
        name: 'tool_start',
        timestamp: 1000,
        attributes: { tool: 'search' },
      });
      expect(tree[0].events[1]).toEqual({
        name: 'tool_end',
        timestamp: 2000,
      });
    });

    it('returns empty array for empty events string', () => {
      const spans: SpanRecord[] = [makeSpan({ events: '[]' })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].events).toEqual([]);
    });

    it('skips events without a name', () => {
      const evts = [
        { name: 'valid_event', timestamp: 1000 },
        { timestamp: 2000 },
        { name: '', timestamp: 3000 },
      ];

      const spans: SpanRecord[] = [makeSpan({ events: JSON.stringify(evts) })];

      const tree = buildSpanTree(spans, 'completed');
      // Only the first event with a truthy name should be included
      expect(tree[0].events).toHaveLength(1);
      expect(tree[0].events[0].name).toBe('valid_event');
    });

    it('handles malformed events JSON gracefully', () => {
      const spans: SpanRecord[] = [makeSpan({ events: 'not valid json{{{' })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].events).toEqual([]);
    });

    it('skips null entries in events array', () => {
      const evts = [null, { name: 'real_event', timestamp: 1000 }, undefined];

      const spans: SpanRecord[] = [makeSpan({ events: JSON.stringify(evts) })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].events).toHaveLength(1);
      expect(tree[0].events[0].name).toBe('real_event');
    });

    it('omits attributes key when attributes object is empty', () => {
      const evts = [{ name: 'event_no_attrs', timestamp: 1000, attributes: {} }];

      const spans: SpanRecord[] = [makeSpan({ events: JSON.stringify(evts) })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].events[0]).toEqual({
        name: 'event_no_attrs',
        timestamp: 1000,
      });
      expect(tree[0].events[0]).not.toHaveProperty('attributes');
    });

    it('defaults timestamp to 0 when missing', () => {
      const evts = [{ name: 'no_ts' }];

      const spans: SpanRecord[] = [makeSpan({ events: JSON.stringify(evts) })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].events[0].timestamp).toBe(0);
    });
  });

  // ── LLM span enrichment ───────────────────────────────────────

  describe('LLM span enrichment (llmInfo)', () => {
    it('computes tokensPerSecond from completion tokens and duration', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          duration_ms: 2000,
          attributes: JSON.stringify({
            'ai.model': 'gpt-5.4',
            'llm.completion_tokens': 100,
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].llmInfo).not.toBeNull();
      // 100 tokens / 2 seconds = 50.0 tokens/sec
      expect(tree[0].llmInfo!.tokensPerSecond).toBe(50);
    });

    it('falls back to ai.completion_tokens when llm.completion_tokens is missing', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          duration_ms: 1000,
          attributes: JSON.stringify({
            'ai.completion_tokens': 200,
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].llmInfo!.tokensPerSecond).toBe(200);
    });

    it('returns null tokensPerSecond when no completion tokens', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          duration_ms: 1000,
          attributes: JSON.stringify({ 'ai.model': 'gpt-5.4' }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].llmInfo!.tokensPerSecond).toBeNull();
    });

    it('returns null tokensPerSecond when duration is 0', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          duration_ms: 0,
          attributes: JSON.stringify({ 'llm.completion_tokens': 100 }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].llmInfo!.tokensPerSecond).toBeNull();
    });

    it('returns null tokensPerSecond when duration is null', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          duration_ms: null,
          attributes: JSON.stringify({ 'llm.completion_tokens': 100 }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].llmInfo!.tokensPerSecond).toBeNull();
    });

    it('computes messageCount from JSON array prompt', () => {
      const messages = [
        { role: 'system', content: 'You are a bot' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];

      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          attributes: JSON.stringify({
            'ai.prompt': JSON.stringify(messages),
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].llmInfo!.messageCount).toBe(3);
    });

    it('sets messageCount to 1 for non-array prompt', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          attributes: JSON.stringify({
            'ai.prompt': 'Just a plain string prompt',
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].llmInfo!.messageCount).toBe(1);
    });

    it('sets messageCount to null when no prompt', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          attributes: JSON.stringify({ 'ai.model': 'gpt-5.4' }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].llmInfo!.messageCount).toBeNull();
    });

    it('computes responseLength from ai.response', () => {
      const longResponse = 'x'.repeat(500);
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          attributes: JSON.stringify({ 'ai.response': longResponse }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].llmInfo!.responseLength).toBe(500);
    });

    it('sets responseLength to null when no response', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          attributes: JSON.stringify({ 'ai.model': 'gpt-5.4' }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].llmInfo!.responseLength).toBeNull();
    });

    it('sets llmInfo to null for non-LLM spans', () => {
      const spans: SpanRecord[] = [
        makeSpan({ kind: 'tool', attributes: '{}' }),
        makeSpan({ id: 'span-2', kind: 'agent', attributes: '{}' }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].llmInfo).toBeNull();
      expect(tree[1].llmInfo).toBeNull();
    });

    it('rounds tokensPerSecond to 2 decimal places', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'llm',
          duration_ms: 3000,
          attributes: JSON.stringify({ 'llm.completion_tokens': 100 }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      // 100 / 3 = 33.333... → 33.33
      expect(tree[0].llmInfo!.tokensPerSecond).toBe(33.33);
    });
  });

  // ── Edge cases ────────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles empty attributes object', () => {
      const spans: SpanRecord[] = [makeSpan({ attributes: '{}' })];

      const tree = buildSpanTree(spans, 'completed');
      const node = tree[0];

      expect(node.input).toBeNull();
      expect(node.output).toBeNull();
      expect(node.error).toBeNull();
      expect(node.model).toBeNull();
      expect(node.toolName).toBeNull();
      expect(node.toolId).toBeNull();
      expect(node.events).toEqual([]);
    });

    it('stores full attributes as metadata', () => {
      const attrs = {
        'ai.model': 'gpt-5.4',
        'ai.prompt': 'test',
        'custom.field': 42,
      };

      const spans: SpanRecord[] = [makeSpan({ attributes: JSON.stringify(attrs) })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].metadata).toEqual(attrs);
    });

    it('handles deeply nested span tree', () => {
      const spans: SpanRecord[] = [
        makeSpan({ id: 'level-0' }),
        makeSpan({ id: 'level-1', parent_span_id: 'level-0' }),
        makeSpan({ id: 'level-2', parent_span_id: 'level-1' }),
        makeSpan({ id: 'level-3', parent_span_id: 'level-2' }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree).toHaveLength(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].children).toHaveLength(1);
      expect(tree[0].children[0].children[0].children[0].id).toBe('level-3');
    });

    it('handles tool span with input that has many parameters', () => {
      const manyParams: Record<string, number> = {};
      for (let i = 0; i < 50; i++) manyParams[`param_${i}`] = i;

      const spans: SpanRecord[] = [
        makeSpan({
          kind: 'tool',
          attributes: JSON.stringify({
            'tool.name': 'complex_tool',
            'tool.input': manyParams,
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].toolInfo!.parameterCount).toBe(50);
    });

    it('handles mixed span kinds in a single tree', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          id: 'agent-root',
          kind: 'agent',
          attributes: '{}',
        }),
        makeSpan({
          id: 'llm-child',
          parent_span_id: 'agent-root',
          kind: 'llm',
          duration_ms: 1000,
          attributes: JSON.stringify({
            'ai.prompt': 'test',
            'ai.response': 'answer',
            'llm.completion_tokens': 50,
          }),
        }),
        makeSpan({
          id: 'tool-child',
          parent_span_id: 'agent-root',
          kind: 'tool',
          attributes: JSON.stringify({
            'tool.name': 'search',
            'tool.input': { query: 'test' },
            'tool.output': { results: [] },
          }),
        }),
      ];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree).toHaveLength(1);

      const agent = tree[0];
      expect(agent.toolInfo).toBeNull();
      expect(agent.llmInfo).toBeNull();

      const llm = agent.children.find((c) => c.id === 'llm-child')!;
      expect(llm.llmInfo).not.toBeNull();
      expect(llm.llmInfo!.tokensPerSecond).toBe(50);
      expect(llm.toolInfo).toBeNull();

      const tool = agent.children.find((c) => c.id === 'tool-child')!;
      expect(tool.toolName).toBe('search');
      expect(tool.toolInfo).not.toBeNull();
      expect(tool.llmInfo).toBeNull();
    });

    it('handles null end_time and duration_ms', () => {
      const spans: SpanRecord[] = [
        makeSpan({
          status: 'pending',
          end_time: null,
          duration_ms: null,
        }),
      ];

      const tree = buildSpanTree(spans, 'pending');
      expect(tree[0].endTime).toBeNull();
      expect(tree[0].duration).toBeNull();
      expect(tree[0].status).toBe('pending');
    });

    it('handles events with rich attributes', () => {
      const evts = [
        {
          name: 'llm.thinking',
          timestamp: 1500,
          attributes: {
            'thinking.tokens': 42,
            'thinking.content': 'Let me analyze...',
            'thinking.nested': { key: 'value' },
          },
        },
      ];

      const spans: SpanRecord[] = [makeSpan({ events: JSON.stringify(evts) })];

      const tree = buildSpanTree(spans, 'completed');
      expect(tree[0].events[0].attributes).toEqual({
        'thinking.tokens': 42,
        'thinking.content': 'Let me analyze...',
        'thinking.nested': { key: 'value' },
      });
    });
  });
});
