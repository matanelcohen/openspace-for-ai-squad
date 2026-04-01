/**
 * Trace Enrichment — E2E Smoke Test
 *
 * End-to-end test that verifies the full trace pipeline:
 *   1. Ingest realistic OTLP trace data (agent → tool → LLM spans)
 *   2. Fetch via the REST API
 *   3. Assert tool names, inputs, outputs, and span structure
 *
 * This test exercises the real API server via HTTP requests.
 */
import { expect, test } from '@playwright/test';

// The API runs on port 3001 per playwright.config.ts
const API_BASE = 'http://localhost:3001';

/** Helper: build an OTLP ExportTraceServiceRequest */
function makeOtlpPayload(
  traceId: string,
  spans: Array<{
    spanId: string;
    parentSpanId?: string;
    name: string;
    kind?: number;
    status?: { code: number };
    startTimeMs: number;
    endTimeMs?: number;
    attributes?: Record<string, string | number | boolean>;
  }>,
) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'e2e-test-agent' } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: 'e2e-test', version: '1.0.0' },
            spans: spans.map((s) => ({
              traceId,
              spanId: s.spanId,
              parentSpanId: s.parentSpanId,
              name: s.name,
              kind: s.kind ?? 1,
              startTimeUnixNano: String(BigInt(s.startTimeMs) * BigInt(1_000_000)),
              endTimeUnixNano: s.endTimeMs
                ? String(BigInt(s.endTimeMs) * BigInt(1_000_000))
                : undefined,
              status: s.status ?? { code: 1 },
              attributes: s.attributes
                ? Object.entries(s.attributes).map(([key, val]) => ({
                    key,
                    value:
                      typeof val === 'string'
                        ? { stringValue: val }
                        : typeof val === 'number'
                          ? Number.isInteger(val)
                            ? { intValue: String(val) }
                            : { doubleValue: val }
                          : { boolValue: val },
                  }))
                : [],
            })),
          },
        ],
      },
    ],
  };
}

test.describe('Trace Enrichment — E2E Smoke', () => {
  // Use a unique traceId per test run to avoid collisions
  const TEST_TRACE_ID = `e2e${Date.now().toString(16).padStart(28, '0')}`;
  const AGENT_SPAN_ID = `a1${Date.now().toString(16).padStart(14, '0')}`;
  const TOOL_SPAN_ID = `t1${Date.now().toString(16).padStart(14, '0')}`;
  const LLM_SPAN_ID = `l1${Date.now().toString(16).padStart(14, '0')}`;
  const TOOL2_SPAN_ID = `t2${Date.now().toString(16).padStart(14, '0')}`;
  const now = Date.now();

  test.beforeAll(async ({ request }) => {
    // Ingest a realistic agent trace via OTLP
    const payload = makeOtlpPayload(TEST_TRACE_ID, [
      {
        spanId: AGENT_SPAN_ID,
        name: 'agent:code-reviewer',
        kind: 1,
        startTimeMs: now - 2000,
        endTimeMs: now,
        status: { code: 1 },
        attributes: {
          'ai.agent_id': 'code-reviewer',
          'ai.task_title': 'Review PR #42',
        },
      },
      {
        spanId: TOOL_SPAN_ID,
        parentSpanId: AGENT_SPAN_ID,
        name: 'tool:Git Diff',
        kind: 1,
        startTimeMs: now - 1800,
        endTimeMs: now - 1200,
        status: { code: 1 },
        attributes: {
          'tool.name': 'Git Diff',
          'tool.input': 'main..feature-branch',
          'tool.output': '+42 lines, -10 lines',
          'tool.duration_ms': 600,
        },
      },
      {
        spanId: LLM_SPAN_ID,
        parentSpanId: AGENT_SPAN_ID,
        name: 'llm:gpt-4o',
        kind: 1,
        startTimeMs: now - 1200,
        endTimeMs: now - 200,
        status: { code: 1 },
        attributes: {
          'ai.model': 'gpt-4o',
          'ai.prompt': 'Review the following diff...',
          'ai.response': 'The changes look good. Consider adding tests.',
        },
      },
      {
        spanId: TOOL2_SPAN_ID,
        parentSpanId: AGENT_SPAN_ID,
        name: 'tool:File Writer',
        kind: 1,
        startTimeMs: now - 200,
        endTimeMs: now - 50,
        status: { code: 1 },
        attributes: {
          'tool.name': 'File Writer',
          'tool.input': 'review-comment.md',
          'tool.output': 'File written successfully',
          'tool.duration_ms': 150,
        },
      },
    ]);

    const res = await request.post(`${API_BASE}/v1/traces`, {
      data: payload,
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBe(true);
  });

  test('trace is retrievable via GET /api/traces/:id', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/traces/${TEST_TRACE_ID}`);
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body.id).toBe(TEST_TRACE_ID);
    expect(body.spanCount).toBe(4);
  });

  test('trace has correct root span with children', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/traces/${TEST_TRACE_ID}`);
    const body = await res.json();

    const root = body.rootSpan;
    expect(root).toBeDefined();
    expect(root.name).toBe('agent:code-reviewer');
    expect(root.children.length).toBe(3);
  });

  test('tool spans have correct name, input, and output in metadata', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/traces/${TEST_TRACE_ID}`);
    const body = await res.json();

    const children = body.rootSpan.children;

    // Find Git Diff tool span
    const gitDiff = children.find(
      (c: Record<string, unknown>) => c.name === 'tool:Git Diff',
    );
    expect(gitDiff).toBeDefined();
    expect(gitDiff.metadata['tool.name']).toBe('Git Diff');
    expect(gitDiff.metadata['tool.input']).toBe('main..feature-branch');
    expect(gitDiff.metadata['tool.output']).toBe('+42 lines, -10 lines');
    expect(gitDiff.metadata['tool.duration_ms']).toBe(600);

    // Find File Writer tool span
    const fileWriter = children.find(
      (c: Record<string, unknown>) => c.name === 'tool:File Writer',
    );
    expect(fileWriter).toBeDefined();
    expect(fileWriter.metadata['tool.name']).toBe('File Writer');
    expect(fileWriter.metadata['tool.input']).toBe('review-comment.md');
    expect(fileWriter.metadata['tool.output']).toBe('File written successfully');
  });

  test('LLM span has model, prompt, and response', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/traces/${TEST_TRACE_ID}`);
    const body = await res.json();

    const llmSpan = body.rootSpan.children.find(
      (c: Record<string, unknown>) => c.name === 'llm:gpt-4o',
    );
    expect(llmSpan).toBeDefined();
    expect(llmSpan.model).toBe('gpt-4o');
    expect(llmSpan.input?.prompt).toBe('Review the following diff...');
    expect(llmSpan.output?.response).toBe(
      'The changes look good. Consider adding tests.',
    );
  });

  test('trace appears in GET /api/traces list', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/traces`);
    expect(res.ok()).toBe(true);

    const traces = await res.json();
    const found = traces.find(
      (t: Record<string, unknown>) => t.id === TEST_TRACE_ID,
    );
    expect(found).toBeDefined();
    expect(found.spanCount).toBe(4);
  });

  test('GET /api/traces/stats reflects the ingested trace', async ({
    request,
  }) => {
    const res = await request.get(`${API_BASE}/api/traces/stats`);
    expect(res.ok()).toBe(true);

    const stats = await res.json();
    expect(stats.totalTraces).toBeGreaterThanOrEqual(1);
    expect(stats.avgLatency).toBeGreaterThanOrEqual(0);
    expect(typeof stats.totalCost).toBe('number');
    expect(typeof stats.totalTokens).toBe('number');
    expect(typeof stats.errorRate).toBe('number');
  });
});
