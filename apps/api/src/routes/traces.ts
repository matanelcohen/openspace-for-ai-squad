/**
 * Traces API — serves real AI interaction trace data from SQLite.
 *
 * GET /api/traces         — list traces (newest first) with optional filters
 * GET /api/traces/stats   — aggregate trace statistics
 * GET /api/traces/:id     — single trace with full span tree
 */

import type { FastifyPluginAsync } from 'fastify';

import type { SpanRecord, TraceRecord, TraceService } from '../services/traces/index.js';

// ── Response mapping helpers ──────────────────────────────────────

type FrontendStatus = 'success' | 'error' | 'running' | 'pending';

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

interface TraceSummaryResponse {
  id: string;
  name: string;
  agentName: string;
  status: FrontendStatus;
  startTime: number;
  duration: number | null;
  totalTokens: number;
  totalCost: number;
  spanCount: number;
  errorCount: number;
}

function toTraceSummary(row: TraceRecord): TraceSummaryResponse {
  return {
    id: row.id,
    name: row.root_span_name || 'AI Completion',
    agentName: row.agent_name ?? 'unknown',
    status: mapStatus(row.status),
    startTime: row.start_time,
    duration: row.duration_ms,
    totalTokens: row.total_tokens,
    totalCost: row.cost_usd,
    spanCount: row.span_count,
    errorCount: row.status === 'error' ? 1 : 0,
  };
}

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
      kind: s.kind as SpanResponse['kind'],
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

  // Build tree
  for (const node of spanMap.values()) {
    if (node.parentId && spanMap.has(node.parentId)) {
      spanMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Route ─────────────────────────────────────────────────────────

const tracesRoute: FastifyPluginAsync = async (app) => {
  // GET /api/traces — list trace summaries
  app.get<{
    Querystring: { limit?: string; agent?: string; status?: string };
  }>('/traces', async (request, reply) => {
    const limit = request.query.limit ? Number(request.query.limit) : undefined;
    const agent = request.query.agent || undefined;
    const status = request.query.status || undefined;

    const rows = app.traceService.listTraces({ limit, agent, status });
    return reply.send(rows.map(toTraceSummary));
  });

  // GET /api/traces/stats — aggregate statistics
  app.get('/traces/stats', async (_request, reply) => {
    const stats = app.traceService.getStats();
    return reply.send({
      ...stats,
      latencyDistribution: [],
      costOverTime: [],
      tokenUsage: [],
      errorsByAgent: [],
      tracesByAgent: [],
    });
  });

  // GET /api/traces/:id — single trace with span tree
  app.get<{
    Params: { id: string };
  }>('/traces/:id', async (request, reply) => {
    const result = app.traceService.getTrace(request.params.id);
    if (!result) {
      return reply.status(404).send({ error: 'Trace not found' });
    }

    const { trace, spans } = result;
    const spanTree = buildSpanTree(spans, trace.status);
    const rootSpan = spanTree[0] ?? {
      id: trace.id,
      traceId: trace.id,
      parentId: null,
      name: trace.root_span_name,
      kind: 'llm',
      status: mapStatus(trace.status),
      startTime: trace.start_time,
      endTime: trace.end_time,
      duration: trace.duration_ms,
      input: null,
      output: null,
      error: trace.error_message,
      tokens: null,
      cost: null,
      model: null,
      metadata: {},
      children: [],
    };

    return reply.send({
      id: trace.id,
      name: trace.root_span_name || 'AI Completion',
      agentName: trace.agent_name ?? 'unknown',
      status: mapStatus(trace.status),
      startTime: trace.start_time,
      endTime: trace.end_time,
      duration: trace.duration_ms,
      totalTokens: trace.total_tokens,
      totalCost: trace.cost_usd,
      spanCount: trace.span_count,
      errorCount: trace.status === 'error' ? 1 : 0,
      rootSpan,
    });
  });

  // DELETE /api/traces — clear all traces
  app.delete('/traces', async (_request, reply) => {
    app.traceService.clearAll();
    return reply.send({ message: 'All traces cleared' });
  });

  // DELETE /api/traces/:id — delete a single trace
  app.delete<{ Params: { id: string } }>('/traces/:id', async (request, reply) => {
    app.traceService.deleteTrace(request.params.id);
    return reply.send({ message: 'Trace deleted' });
  });
};

export default tracesRoute;

// ── Fastify type augmentation ────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    traceService: TraceService;
  }
}
