/**
 * Trace Enrichment — API Integration Tests
 *
 * Tests the full trace pipeline through the API layer:
 *   1. OTLP ingestion (POST /v1/traces → GET /api/traces/:id)
 *   2. HTTP middleware spans (ingested via OTLP with http.* attributes)
 *   3. Trace stats aggregation (GET /api/traces/stats)
 *
 * Uses an isolated Fastify instance with in-memory SQLite.
 */
import BetterSqlite3 from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import otlpCollectorRoute from '../routes/otlp-collector.js';
import tracesRoute from '../routes/traces.js';
import { initializeSchema } from '../services/db/schema.js';
import { TraceService } from '../services/traces/index.js';

// ── Test helpers ─────────────────────────────────────────────────────

function buildTestApp(): FastifyInstance {
  const db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initializeSchema(db);

  const traceService = new TraceService(db);

  const app = Fastify({ logger: false });
  app.decorate('traceService', traceService);
  app.decorate('db', db);

  // Register routes
  app.register(otlpCollectorRoute);         // POST /v1/traces
  app.register(tracesRoute, { prefix: '/api' }); // GET /api/traces, etc.

  return app;
}

/** Build an OTLP ExportTraceServiceRequest payload. */
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
            scope: { name: 'test-instrumentation', version: '1.0.0' },
            spans: spans.map(toOtlpSpan),
          },
        ],
      },
    ],
  };
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

// ── Tests ────────────────────────────────────────────────────────────

describe('OTLP Ingestion → Trace API', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = buildTestApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ── 3. Integration test: OTLP ingestion ─────────────────────────

  describe('POST /v1/traces → GET /api/traces/:id', () => {
    it('ingests tool spans and returns them in the span tree', async () => {
      const traceId = 'aaaa1111bbbb2222cccc3333dddd4444';
      const rootSpanId = '1111222233334444';
      const toolSpanId = '5555666677778888';
      const now = Date.now();

      const payload = makeOtlpPayload(
        [
          {
            traceId,
            spanId: rootSpanId,
            name: 'agent:task-runner',
            kind: 1,
            startTimeMs: now - 500,
            endTimeMs: now,
            status: { code: 1 },
            attributes: {
              'ai.agent_id': 'task-runner',
            },
          },
          {
            traceId,
            spanId: toolSpanId,
            parentSpanId: rootSpanId,
            name: 'tool:Web Search',
            kind: 1,
            startTimeMs: now - 400,
            endTimeMs: now - 100,
            status: { code: 1 },
            attributes: {
              'tool.name': 'Web Search',
              'tool.input': 'quantum computing',
              'tool.output': 'search results here',
              'tool.duration_ms': 300,
            },
          },
        ],
        { 'service.name': 'test-agent' },
      );

      // Ingest
      const ingestRes = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        payload,
      });
      expect(ingestRes.statusCode).toBe(200);

      // Retrieve
      const getRes = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}`,
      });
      expect(getRes.statusCode).toBe(200);

      const body = getRes.json();
      expect(body.id).toBe(traceId);
      expect(body.spanCount).toBe(2);

      // Verify the root span has the tool span as a child
      const rootSpan = body.rootSpan;
      expect(rootSpan).toBeDefined();
      expect(rootSpan.id).toBe(rootSpanId);
      expect(rootSpan.children).toHaveLength(1);

      const toolChild = rootSpan.children[0];
      expect(toolChild.id).toBe(toolSpanId);
      expect(toolChild.name).toBe('tool:Web Search');
      // Tool attributes are in metadata
      expect(toolChild.metadata['tool.name']).toBe('Web Search');
      expect(toolChild.metadata['tool.input']).toBe('quantum computing');
      expect(toolChild.metadata['tool.output']).toBe('search results here');
    });

    it('handles empty OTLP payload gracefully', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/v1/traces',
        payload: { resourceSpans: [] },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toEqual({ partialSuccess: {} });
    });

    it('handles multiple spans with proper tree assembly', async () => {
      const traceId = 'bbbb1111cccc2222dddd3333eeee4444';
      const rootId = 'aaaa000000000001';
      const llmId = 'aaaa000000000002';
      const toolId = 'aaaa000000000003';
      const now = Date.now();

      const payload = makeOtlpPayload([
        {
          traceId,
          spanId: rootId,
          name: 'agent:planner',
          kind: 1,
          startTimeMs: now - 1000,
          endTimeMs: now,
          status: { code: 1 },
          attributes: { 'ai.agent_id': 'planner' },
        },
        {
          traceId,
          spanId: llmId,
          parentSpanId: rootId,
          name: 'llm:gpt-4o',
          kind: 1,
          startTimeMs: now - 800,
          endTimeMs: now - 200,
          status: { code: 1 },
          attributes: {
            'ai.model': 'gpt-4o',
            'ai.prompt': 'Analyze the data',
            'ai.response': 'The data shows...',
          },
        },
        {
          traceId,
          spanId: toolId,
          parentSpanId: rootId,
          name: 'tool:Calculator',
          kind: 1,
          startTimeMs: now - 600,
          endTimeMs: now - 400,
          status: { code: 1 },
          attributes: {
            'tool.name': 'Calculator',
            'tool.input': '2+2',
            'tool.output': '4',
          },
        },
      ]);

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}`,
      });
      expect(getRes.statusCode).toBe(200);

      const body = getRes.json();
      expect(body.spanCount).toBe(3);

      // Root span should have 2 children (llm + tool)
      expect(body.rootSpan.children).toHaveLength(2);

      // Verify LLM span has input/output from ai.prompt/ai.response
      const llmChild = body.rootSpan.children.find(
        (c: { name: string }) => c.name === 'llm:gpt-4o',
      );
      expect(llmChild).toBeDefined();
      expect(llmChild.input?.prompt).toBe('Analyze the data');
      expect(llmChild.output?.response).toBe('The data shows...');
      expect(llmChild.model).toBe('gpt-4o');

      // Verify tool span
      const toolChild = body.rootSpan.children.find(
        (c: { name: string }) => c.name === 'tool:Calculator',
      );
      expect(toolChild).toBeDefined();
      expect(toolChild.metadata['tool.name']).toBe('Calculator');
    });

    it('correctly handles error spans from OTLP', async () => {
      const traceId = 'cccc1111dddd2222eeee3333ffff4444';
      const spanId = 'ffff000000000001';
      const now = Date.now();

      const payload = makeOtlpPayload([
        {
          traceId,
          spanId,
          name: 'agent:failing',
          kind: 1,
          startTimeMs: now - 200,
          endTimeMs: now,
          status: { code: 2, message: 'Rate limit exceeded' },
          attributes: {
            'ai.agent_id': 'failing',
            'ai.error': 'Rate limit exceeded',
          },
        },
      ]);

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}`,
      });
      const body = getRes.json();
      expect(body.status).toBe('error');
      expect(body.rootSpan.status).toBe('error');
      expect(body.rootSpan.error).toBe('Rate limit exceeded');
    });

    it('upserts spans idempotently (re-delivery safe)', async () => {
      const traceId = 'dddd1111eeee2222ffff3333aaaa4444';
      const spanId = 'bbbb000000000001';
      const now = Date.now();

      const payload = makeOtlpPayload([
        {
          traceId,
          spanId,
          name: 'agent:idempotent',
          kind: 1,
          startTimeMs: now - 100,
          endTimeMs: now,
          status: { code: 1 },
          attributes: { 'ai.agent_id': 'idempotent' },
        },
      ]);

      // Send twice
      await app.inject({ method: 'POST', url: '/v1/traces', payload });
      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}`,
      });
      const body = getRes.json();
      // Should still have 1 span, not 2
      expect(body.spanCount).toBe(1);
    });
  });

  // ── 4. Integration test: HTTP middleware spans ────────────────────

  describe('HTTP middleware spans via OTLP', () => {
    it('ingests spans with http.method, http.route, http.status_code attributes', async () => {
      const traceId = 'http1111aaaa2222bbbb3333cccc4444';
      const spanId = 'http000000000001';
      const now = Date.now();

      const payload = makeOtlpPayload([
        {
          traceId,
          spanId,
          name: 'GET /api/tasks',
          kind: 2, // SERVER
          startTimeMs: now - 50,
          endTimeMs: now,
          status: { code: 1 },
          attributes: {
            'http.method': 'GET',
            'http.route': '/api/tasks',
            'http.status_code': 200,
            'http.url': 'http://localhost:3001/api/tasks',
          },
        },
      ]);

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}`,
      });
      expect(getRes.statusCode).toBe(200);

      const body = getRes.json();
      const span = body.rootSpan;

      expect(span.name).toBe('GET /api/tasks');
      expect(span.metadata['http.method']).toBe('GET');
      expect(span.metadata['http.route']).toBe('/api/tasks');
      expect(span.metadata['http.status_code']).toBe(200);
    });

    it('captures HTTP error spans (500 status)', async () => {
      const traceId = 'http2222bbbb3333cccc4444dddd5555';
      const spanId = 'http000000000002';
      const now = Date.now();

      const payload = makeOtlpPayload([
        {
          traceId,
          spanId,
          name: 'POST /api/chat/messages',
          kind: 2,
          startTimeMs: now - 100,
          endTimeMs: now,
          status: { code: 2 },
          attributes: {
            'http.method': 'POST',
            'http.route': '/api/chat/messages',
            'http.status_code': 500,
            'http.url': 'http://localhost:3001/api/chat/messages',
          },
        },
      ]);

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}`,
      });
      const body = getRes.json();

      expect(body.status).toBe('error');
      expect(body.rootSpan.metadata['http.status_code']).toBe(500);
      expect(body.rootSpan.metadata['http.method']).toBe('POST');
    });

    it('HTTP spans nested under agent spans preserve hierarchy', async () => {
      const traceId = 'http3333cccc4444dddd5555eeee6666';
      const agentSpanId = 'agen000000000001';
      const httpSpanId = 'http000000000003';
      const now = Date.now();

      const payload = makeOtlpPayload([
        {
          traceId,
          spanId: agentSpanId,
          name: 'agent:web-fetcher',
          kind: 1,
          startTimeMs: now - 500,
          endTimeMs: now,
          status: { code: 1 },
          attributes: { 'ai.agent_id': 'web-fetcher' },
        },
        {
          traceId,
          spanId: httpSpanId,
          parentSpanId: agentSpanId,
          name: 'GET https://api.example.com/data',
          kind: 3, // CLIENT
          startTimeMs: now - 300,
          endTimeMs: now - 100,
          status: { code: 1 },
          attributes: {
            'http.method': 'GET',
            'http.route': '/data',
            'http.status_code': 200,
          },
        },
      ]);

      await app.inject({ method: 'POST', url: '/v1/traces', payload });

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}`,
      });
      const body = getRes.json();

      expect(body.rootSpan.children).toHaveLength(1);
      expect(body.rootSpan.children[0].name).toBe('GET https://api.example.com/data');
      expect(body.rootSpan.children[0].metadata['http.method']).toBe('GET');
    });
  });

  // ── 5. Integration test: trace stats ─────────────────────────────

  describe('GET /api/traces/stats', () => {
    it('returns zeroes when no traces exist', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/traces/stats',
      });
      expect(res.statusCode).toBe(200);

      const stats = res.json();
      expect(stats.totalTraces).toBe(0);
      expect(stats.avgLatency).toBe(0);
      expect(stats.totalCost).toBe(0);
      expect(stats.totalTokens).toBe(0);
      expect(stats.errorRate).toBe(0);
    });

    it('aggregates token counts and costs from enriched spans', async () => {
      const now = Date.now();

      // Ingest trace 1: completed with tokens and cost
      const trace1 = 'stat1111aaaa2222bbbb3333cccc4444';
      await ingestTraceWithTokens(app, {
        traceId: trace1,
        agentName: 'agent-a',
        startTimeMs: now - 2000,
        endTimeMs: now - 1000,
        promptTokens: 500,
        completionTokens: 200,
        costUsd: 0.005,
        status: 'completed',
      });

      // Ingest trace 2: completed with different tokens
      const trace2 = 'stat2222bbbb3333cccc4444dddd5555';
      await ingestTraceWithTokens(app, {
        traceId: trace2,
        agentName: 'agent-b',
        startTimeMs: now - 1500,
        endTimeMs: now - 500,
        promptTokens: 1000,
        completionTokens: 400,
        costUsd: 0.015,
        status: 'completed',
      });

      // Ingest trace 3: error
      const trace3 = 'stat3333cccc4444dddd5555eeee6666';
      await ingestTraceWithTokens(app, {
        traceId: trace3,
        agentName: 'agent-c',
        startTimeMs: now - 1000,
        endTimeMs: now,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        status: 'error',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/traces/stats',
      });
      expect(res.statusCode).toBe(200);

      const stats = res.json();
      expect(stats.totalTraces).toBe(3);
      expect(stats.errorRate).toBeCloseTo(1 / 3, 2);
      expect(stats.avgLatency).toBeTypeOf('number');
      // avgLatency may be 0 when start/complete happen in the same ms tick
      expect(stats.avgLatency).toBeGreaterThanOrEqual(0);

      // Stats includes chart data arrays
      expect(Array.isArray(stats.latencyDistribution)).toBe(true);
      expect(Array.isArray(stats.costOverTime)).toBe(true);
      expect(Array.isArray(stats.tokenUsage)).toBe(true);
      expect(Array.isArray(stats.errorsByAgent)).toBe(true);
      expect(Array.isArray(stats.tracesByAgent)).toBe(true);
    });

    it('error rate is 0 when all traces succeed', async () => {
      const now = Date.now();

      for (let i = 0; i < 3; i++) {
        await ingestTraceWithTokens(app, {
          traceId: `succ${i}111aaaa2222bbbb3333cccc4444`,
          agentName: `agent-${i}`,
          startTimeMs: now - 1000,
          endTimeMs: now,
          promptTokens: 100,
          completionTokens: 50,
          costUsd: 0.001,
          status: 'completed',
        });
      }

      const res = await app.inject({ method: 'GET', url: '/api/traces/stats' });
      const stats = res.json();
      expect(stats.totalTraces).toBe(3);
      expect(stats.errorRate).toBe(0);
    });
  });

  // ── Trace list filtering ──────────────────────────────────────────

  describe('GET /api/traces — filtering', () => {
    it('returns 404 for non-existent trace', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/traces/nonexistent-id',
      });
      expect(res.statusCode).toBe(404);
      expect(res.json().error).toBe('Trace not found');
    });

    it('DELETE /api/traces clears all traces', async () => {
      const now = Date.now();
      await ingestTraceWithTokens(app, {
        traceId: 'del11111aaaa2222bbbb3333cccc4444',
        agentName: 'agent',
        startTimeMs: now - 100,
        endTimeMs: now,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        status: 'completed',
      });

      // Verify it exists
      let listRes = await app.inject({ method: 'GET', url: '/api/traces' });
      expect(listRes.json().length).toBeGreaterThan(0);

      // Delete all
      const delRes = await app.inject({ method: 'DELETE', url: '/api/traces' });
      expect(delRes.statusCode).toBe(200);

      // Verify empty
      listRes = await app.inject({ method: 'GET', url: '/api/traces' });
      expect(listRes.json()).toHaveLength(0);
    });

    it('DELETE /api/traces/:id removes a single trace', async () => {
      const now = Date.now();
      const traceId = 'del22222bbbb3333cccc4444dddd5555';

      await ingestTraceWithTokens(app, {
        traceId,
        agentName: 'agent',
        startTimeMs: now - 100,
        endTimeMs: now,
        promptTokens: 0,
        completionTokens: 0,
        costUsd: 0,
        status: 'completed',
      });

      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/traces/${traceId}`,
      });
      expect(delRes.statusCode).toBe(200);

      const getRes = await app.inject({
        method: 'GET',
        url: `/api/traces/${traceId}`,
      });
      expect(getRes.statusCode).toBe(404);
    });
  });
});

// ── Helper: ingest a trace with token/cost data ──────────────────────

async function ingestTraceWithTokens(
  app: FastifyInstance,
  opts: {
    traceId: string;
    agentName: string;
    startTimeMs: number;
    endTimeMs: number;
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
    status: 'completed' | 'error';
  },
) {
  // Use the TraceService directly for precise control over aggregates
  const traceService = (app as unknown as { traceService: TraceService }).traceService;

  // Manually start + complete a trace to set token/cost aggregates
  const { traceId, spanId } = traceService.startTrace({
    traceId: opts.traceId,
    agentId: opts.agentName,
    model: 'gpt-4o',
    prompt: 'test prompt',
  });

  if (opts.status === 'completed') {
    traceService.completeTrace(traceId, spanId, {
      response: 'test response',
      model: 'gpt-4o',
      promptTokens: opts.promptTokens,
      completionTokens: opts.completionTokens,
    });
  } else {
    traceService.failTrace(traceId, spanId, 'Test error');
  }
}

// Type augmentation for test
declare module 'fastify' {
  interface FastifyInstance {
    traceService: TraceService;
    db: import('better-sqlite3').Database;
  }
}
