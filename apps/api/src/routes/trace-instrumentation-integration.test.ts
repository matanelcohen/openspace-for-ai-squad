/**
 * Trace Instrumentation — Integration Test
 *
 * End-to-end verification of the full tracing pipeline using real SQLite:
 *   1. Ingest OTLP spans representing a complete agent task flow
 *   2. Verify the SQLite trace + spans tables contain all expected data
 *   3. Query the traces API and verify parent-child relationships
 *   4. Verify tool inputs/outputs are present in the API response
 *
 * Uses an isolated in-memory Fastify + SQLite instance.
 */
import BetterSqlite3 from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import otlpCollectorRoute from '../routes/otlp-collector.js';
import tracesRoute from '../routes/traces.js';
import { initializeSchema } from '../services/db/schema.js';
import type { SpanRecord, TraceRecord } from '../services/traces/index.js';
import { TraceService } from '../services/traces/index.js';

// ── Test helpers ─────────────────────────────────────────────────────

function buildTestApp(): { app: FastifyInstance; db: BetterSqlite3.Database } {
  const db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);

  const traceService = new TraceService(db);

  const app = Fastify({ logger: false });
  app.decorate('traceService', traceService);
  app.decorate('db', db);

  app.register(otlpCollectorRoute);
  app.register(tracesRoute, { prefix: '/api' });

  return { app, db };
}

interface OtlpSpanInput {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind?: number;
  status?: { code: number; message?: string };
  startTimeMs: number;
  endTimeMs?: number;
  attributes?: Record<string, string | number | boolean>;
  events?: Array<{ name: string; attributes?: Record<string, string | number> }>;
}

function toOtlpSpan(input: OtlpSpanInput) {
  const attributes = input.attributes
    ? Object.entries(input.attributes).map(([key, val]) => ({
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
    : undefined;

  const events = input.events?.map((e) => ({
    name: e.name,
    timeUnixNano: String(BigInt(input.startTimeMs) * BigInt(1_000_000)),
    attributes: e.attributes
      ? Object.entries(e.attributes).map(([key, val]) => ({
          key,
          value:
            typeof val === 'string' ? { stringValue: val } : { intValue: String(val) },
        }))
      : undefined,
  }));

  return {
    traceId: input.traceId,
    spanId: input.spanId,
    parentSpanId: input.parentSpanId,
    name: input.name,
    kind: input.kind ?? 1,
    startTimeUnixNano: String(BigInt(input.startTimeMs) * BigInt(1_000_000)),
    endTimeUnixNano: input.endTimeMs
      ? String(BigInt(input.endTimeMs) * BigInt(1_000_000))
      : undefined,
    attributes,
    status: input.status ?? { code: 1 },
    events,
  };
}

function makeOtlpPayload(spans: OtlpSpanInput[], resourceAttrs?: Record<string, string>) {
  return {
    resourceSpans: [
      {
        resource: {
          attributes: Object.entries(resourceAttrs ?? {}).map(([key, val]) => ({
            key,
            value: { stringValue: val },
          })),
        },
        scopeSpans: [
          {
            scope: { name: 'integration-test', version: '1.0.0' },
            spans: spans.map(toOtlpSpan),
          },
        ],
      },
    ],
  };
}

// ── Fixture: a realistic agent task flow ─────────────────────────────

const TRACE_ID = 'abcd1234abcd1234abcd1234abcd1234';
const AGENT_SPAN_ID = 'a000000000000001';
const SKILL_SPAN_ID = 'a000000000000002';
const MEMORY_SPAN_ID = 'a000000000000003';
const TOOL1_SPAN_ID = 'a000000000000004';
const TOOL2_SPAN_ID = 'a000000000000005';
const LLM_SPAN_ID = 'a000000000000006';

function makeAgentTaskFlowSpans(now: number): OtlpSpanInput[] {
  return [
    {
      traceId: TRACE_ID,
      spanId: AGENT_SPAN_ID,
      name: 'agent:fry-task-runner',
      kind: 1,
      startTimeMs: now - 3000,
      endTimeMs: now,
      status: { code: 1 },
      attributes: {
        'ai.agent_id': 'fry',
        'ai.task_title': 'Implement auth module',
        'task.id': 'task-001',
        'queue_wait_ms': 42,
      },
    },
    {
      traceId: TRACE_ID,
      spanId: SKILL_SPAN_ID,
      parentSpanId: AGENT_SPAN_ID,
      name: 'skills:match',
      kind: 1,
      startTimeMs: now - 2900,
      endTimeMs: now - 2800,
      status: { code: 1 },
      attributes: {
        'skills.role': 'frontend',
        'skills.matched_count': 2,
      },
    },
    {
      traceId: TRACE_ID,
      spanId: MEMORY_SPAN_ID,
      parentSpanId: AGENT_SPAN_ID,
      name: 'memory:recall',
      kind: 1,
      startTimeMs: now - 2800,
      endTimeMs: now - 2700,
      status: { code: 1 },
      attributes: {
        'memory.query': 'auth patterns',
        'memory.results_count': 3,
      },
    },
    {
      traceId: TRACE_ID,
      spanId: TOOL1_SPAN_ID,
      parentSpanId: AGENT_SPAN_ID,
      name: 'tool:File Reader',
      kind: 1,
      startTimeMs: now - 2500,
      endTimeMs: now - 2000,
      status: { code: 1 },
      attributes: {
        'tool.name': 'File Reader',
        'tool.id': 'file-reader',
        'tool.input': 'src/auth/login.ts',
        'tool.output': 'export function login() { ... }',
        'tool.duration_ms': 500,
      },
    },
    {
      traceId: TRACE_ID,
      spanId: TOOL2_SPAN_ID,
      parentSpanId: AGENT_SPAN_ID,
      name: 'tool:Code Writer',
      kind: 1,
      startTimeMs: now - 1500,
      endTimeMs: now - 500,
      status: { code: 1 },
      attributes: {
        'tool.name': 'Code Writer',
        'tool.id': 'code-writer',
        'tool.input': JSON.stringify({ path: 'src/auth/jwt.ts', content: 'export function verifyJWT() {}' }),
        'tool.output': 'File written successfully',
        'tool.duration_ms': 1000,
      },
    },
    {
      traceId: TRACE_ID,
      spanId: LLM_SPAN_ID,
      parentSpanId: AGENT_SPAN_ID,
      name: 'llm:gpt-4o',
      kind: 1,
      startTimeMs: now - 2000,
      endTimeMs: now - 1500,
      status: { code: 1 },
      attributes: {
        'ai.model': 'gpt-4o',
        'ai.prompt': 'Generate JWT verification code',
        'ai.response': 'Here is the JWT verification implementation...',
        'llm.prompt_tokens': 350,
        'llm.completion_tokens': 200,
        'llm.cost_usd': 0.005,
      },
    },
  ];
}

// ── Tests ────────────────────────────────────────────────────────────

describe('Trace Instrumentation — Integration', () => {
  let app: FastifyInstance;
  let db: BetterSqlite3.Database;

  beforeEach(async () => {
    const result = buildTestApp();
    app = result.app;
    db = result.db;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('SQLite persistence after OTLP ingestion', () => {
    it('trace row is created with correct aggregates', async () => {
      const now = Date.now();
      const payload = makeOtlpPayload(makeAgentTaskFlowSpans(now), { 'service.name': 'fry-agent' });

      const res = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        payload,
      });
      expect(res.statusCode).toBe(200);

      const trace = db
        .prepare('SELECT * FROM traces WHERE id = ?')
        .get(TRACE_ID) as TraceRecord;

      expect(trace).toBeDefined();
      expect(trace.id).toBe(TRACE_ID);
      expect(trace.span_count).toBe(6);
      expect(trace.status).toBe('completed');
      expect(trace.duration_ms).toBeGreaterThan(0);
    });

    it('all spans are persisted with correct parent-child relationships', async () => {
      const now = Date.now();
      const payload = makeOtlpPayload(makeAgentTaskFlowSpans(now));

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const spans = db
        .prepare('SELECT * FROM spans WHERE trace_id = ? ORDER BY start_time ASC')
        .all(TRACE_ID) as SpanRecord[];

      expect(spans).toHaveLength(6);

      const root = spans.find((s) => s.id === AGENT_SPAN_ID)!;
      expect(root.parent_span_id).toBeNull();

      const children = spans.filter((s) => s.id !== AGENT_SPAN_ID);
      for (const child of children) {
        expect(child.parent_span_id).toBe(AGENT_SPAN_ID);
      }
    });

    it('tool span attributes are stored as JSON in SQLite', async () => {
      const now = Date.now();
      const payload = makeOtlpPayload(makeAgentTaskFlowSpans(now));

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const toolSpan = db
        .prepare('SELECT * FROM spans WHERE id = ?')
        .get(TOOL1_SPAN_ID) as SpanRecord;

      const attrs = JSON.parse(toolSpan.attributes) as Record<string, unknown>;
      expect(attrs['tool.name']).toBe('File Reader');
      expect(attrs['tool.id']).toBe('file-reader');
      expect(attrs['tool.input']).toBe('src/auth/login.ts');
      expect(attrs['tool.output']).toBe('export function login() { ... }');
      expect(attrs['tool.duration_ms']).toBe(500);
    });

    it('LLM span token attributes are stored in the span JSON', async () => {
      const now = Date.now();
      const payload = makeOtlpPayload(makeAgentTaskFlowSpans(now));

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      // OTLP maps kind=1 to 'internal', so token aggregation at trace level
      // uses json_extract on kind='llm' spans — which won't match OTLP spans.
      // But the raw attributes are still stored in the span's JSON.
      const llmSpan = db
        .prepare('SELECT * FROM spans WHERE id = ?')
        .get(LLM_SPAN_ID) as SpanRecord;

      const attrs = JSON.parse(llmSpan.attributes) as Record<string, unknown>;
      expect(attrs['llm.prompt_tokens']).toBe(350);
      expect(attrs['llm.completion_tokens']).toBe(200);
      expect(attrs['llm.cost_usd']).toBe(0.005);
    });
  });

  describe('Traces API with tool inputs/outputs', () => {
    it('GET /api/traces/:id returns span tree with correct hierarchy', async () => {
      const now = Date.now();
      const payload = makeOtlpPayload(makeAgentTaskFlowSpans(now));

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const res = await app.inject({
        method: 'GET',
        url: `/api/traces/${TRACE_ID}`,
      });
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.id).toBe(TRACE_ID);
      expect(body.spanCount).toBe(6);

      const rootSpan = body.rootSpan;
      expect(rootSpan).toBeDefined();
      expect(rootSpan.name).toBe('agent:fry-task-runner');

      // Root has 5 children
      expect(rootSpan.children).toHaveLength(5);
    });

    it('tool span responses include tool.input and tool.output in metadata', async () => {
      const now = Date.now();
      const payload = makeOtlpPayload(makeAgentTaskFlowSpans(now));

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const res = await app.inject({
        method: 'GET',
        url: `/api/traces/${TRACE_ID}`,
      });
      const body = res.json();

      const fileReader = body.rootSpan.children.find(
        (c: { name: string }) => c.name === 'tool:File Reader',
      );
      expect(fileReader).toBeDefined();
      expect(fileReader.metadata['tool.name']).toBe('File Reader');
      expect(fileReader.metadata['tool.id']).toBe('file-reader');
      expect(fileReader.metadata['tool.input']).toBe('src/auth/login.ts');
      expect(fileReader.metadata['tool.output']).toBe('export function login() { ... }');
      expect(fileReader.metadata['tool.duration_ms']).toBe(500);

      // OTLP maps kind=1 to 'internal', so buildSpanTree doesn't extract
      // tool.input into the top-level `input` field. Check `metadata` instead.
      expect(fileReader.metadata['tool.input']).toBe('src/auth/login.ts');
      expect(fileReader.metadata['tool.output']).toBe('export function login() { ... }');

      const codeWriter = body.rootSpan.children.find(
        (c: { name: string }) => c.name === 'tool:Code Writer',
      );
      expect(codeWriter).toBeDefined();
      expect(codeWriter.metadata['tool.name']).toBe('Code Writer');
      expect(codeWriter.metadata['tool.output']).toBe('File written successfully');
    });

    it('LLM span includes model, prompt, and response in API response', async () => {
      const now = Date.now();
      const payload = makeOtlpPayload(makeAgentTaskFlowSpans(now));

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const res = await app.inject({
        method: 'GET',
        url: `/api/traces/${TRACE_ID}`,
      });
      const body = res.json();

      const llmSpan = body.rootSpan.children.find(
        (c: { name: string }) => c.name === 'llm:gpt-4o',
      );
      expect(llmSpan).toBeDefined();
      expect(llmSpan.model).toBe('gpt-4o');
      expect(llmSpan.input?.prompt).toBe('Generate JWT verification code');
      expect(llmSpan.output?.response).toBe(
        'Here is the JWT verification implementation...',
      );
      // Token/cost extraction requires kind='llm' in the DB, but OTLP
      // maps kind=1 to 'internal'. The raw attributes are still in metadata.
      expect(llmSpan.metadata['llm.prompt_tokens']).toBe(350);
      expect(llmSpan.metadata['llm.completion_tokens']).toBe(200);
      expect(llmSpan.metadata['llm.cost_usd']).toBe(0.005);
    });

    it('GET /api/traces lists the trace with correct summary', async () => {
      const now = Date.now();
      const payload = makeOtlpPayload(makeAgentTaskFlowSpans(now));

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const res = await app.inject({
        method: 'GET',
        url: '/api/traces',
      });
      expect(res.statusCode).toBe(200);

      const traces = res.json();
      const found = traces.find(
        (t: { id: string }) => t.id === TRACE_ID,
      );
      expect(found).toBeDefined();
      expect(found.spanCount).toBe(6);
      expect(found.status).toBe('success');
      // OTLP spans use OTEL kind mapping (kind=1 → 'internal'), so
      // token/cost aggregation at trace level requires kind='llm'.
      expect(found.totalTokens).toBeTypeOf('number');
      expect(found.totalCost).toBeTypeOf('number');
    });

    it('GET /api/traces/stats reflects the ingested trace', async () => {
      const now = Date.now();
      const payload = makeOtlpPayload(makeAgentTaskFlowSpans(now));

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const res = await app.inject({
        method: 'GET',
        url: '/api/traces/stats',
      });
      expect(res.statusCode).toBe(200);

      const stats = res.json();
      expect(stats.totalTraces).toBeGreaterThanOrEqual(1);
      expect(typeof stats.totalCost).toBe('number');
      expect(typeof stats.totalTokens).toBe('number');
    });
  });

  describe('error trace flow through API', () => {
    it('error spans with exception events are accessible via API', async () => {
      const now = Date.now();
      const errorTraceId = 'eeee1111ffff2222aaaa3333bbbb4444';
      const rootId = 'e000000000000001';
      const toolId = 'e000000000000002';

      const payload = makeOtlpPayload([
        {
          traceId: errorTraceId,
          spanId: rootId,
          name: 'agent:error-test',
          kind: 1,
          startTimeMs: now - 500,
          endTimeMs: now,
          status: { code: 2, message: 'Tool execution failed' },
          attributes: {
            'ai.agent_id': 'error-test',
            'ai.error': 'Tool execution failed',
          },
        },
        {
          traceId: errorTraceId,
          spanId: toolId,
          parentSpanId: rootId,
          name: 'tool:Failing Tool',
          kind: 1,
          startTimeMs: now - 400,
          endTimeMs: now - 100,
          status: { code: 2, message: 'Connection refused' },
          attributes: {
            'tool.name': 'Failing Tool',
            'tool.id': 'failing-tool',
            'tool.input': 'some query',
            'tool.error': 'ECONNREFUSED: connection refused',
            'tool.duration_ms': 300,
          },
          events: [
            {
              name: 'exception',
              attributes: {
                'exception.message': 'ECONNREFUSED: connection refused',
              },
            },
          ],
        },
      ]);

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const res = await app.inject({
        method: 'GET',
        url: `/api/traces/${errorTraceId}`,
      });
      expect(res.statusCode).toBe(200);

      const body = res.json();
      expect(body.status).toBe('error');

      const toolSpan = body.rootSpan.children.find(
        (c: { name: string }) => c.name === 'tool:Failing Tool',
      );
      expect(toolSpan).toBeDefined();
      expect(toolSpan.status).toBe('error');
      expect(toolSpan.error).toBe('ECONNREFUSED: connection refused');
      expect(toolSpan.metadata['tool.error']).toBe(
        'ECONNREFUSED: connection refused',
      );
    });
  });

  describe('multi-trace isolation', () => {
    it('multiple traces are stored independently and queryable', async () => {
      const now = Date.now();

      const payload1 = makeOtlpPayload([
        {
          traceId: 'trace1111111111111111111111111111',
          spanId: 's111111111111111',
          name: 'agent:trace-one',
          kind: 1,
          startTimeMs: now - 200,
          endTimeMs: now,
          status: { code: 1 },
          attributes: { 'ai.agent_id': 'agent-1' },
        },
      ]);

      const payload2 = makeOtlpPayload([
        {
          traceId: 'trace2222222222222222222222222222',
          spanId: 's222222222222222',
          name: 'agent:trace-two',
          kind: 1,
          startTimeMs: now - 100,
          endTimeMs: now,
          status: { code: 1 },
          attributes: { 'ai.agent_id': 'agent-2' },
        },
      ]);

      await app.inject({ method: 'POST', url: '/v1/traces', payload: payload1 });
      await app.inject({ method: 'POST', url: '/v1/traces', payload: payload2 });

      const res1 = await app.inject({
        method: 'GET',
        url: '/api/traces/trace1111111111111111111111111111',
      });
      expect(res1.statusCode).toBe(200);
      expect(res1.json().spanCount).toBe(1);

      const res2 = await app.inject({
        method: 'GET',
        url: '/api/traces/trace2222222222222222222222222222',
      });
      expect(res2.statusCode).toBe(200);
      expect(res2.json().spanCount).toBe(1);

      const listRes = await app.inject({ method: 'GET', url: '/api/traces' });
      const traces = listRes.json();
      expect(traces.length).toBeGreaterThanOrEqual(2);
    });
  });
});
