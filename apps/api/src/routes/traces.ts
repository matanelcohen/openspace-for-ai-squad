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

interface SpanEvent {
  name: string;
  timestamp: number;
  attributes: Record<string, unknown>;
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
  inputPreview: string | null;
  outputPreview: string | null;
  inputSize: number | null;
  outputSize: number | null;
  tokens: { prompt: number; completion: number; total: number } | null;
  cost: number | null;
  model: string | null;
  // LLM-specific fields
  llmProvider: string | null;
  llmStreaming: boolean | null;
  llmTimeToFirstTokenMs: number | null;
  events: SpanEvent[];
  metadata: Record<string, unknown>;
  children: SpanResponse[];
}

// ── Cost calculation (mirrors apps/api/src/services/cost/index.ts) ─

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4.6': { input: 15, output: 75 },
  'claude-sonnet-4.6': { input: 3, output: 15 },
  'claude-haiku-4.5': { input: 0.8, output: 4 },
  'gpt-5.4': { input: 5, output: 15 },
  'gpt-5.1': { input: 2, output: 8 },
  'gpt-4.1': { input: 2, output: 8 },
};

const DEFAULT_PRICING = { input: 3, output: 15 };

function calcSpanCost(
  promptTokens: number,
  completionTokens: number,
  model: string | null,
): number {
  const p = (model && MODEL_PRICING[model]) || DEFAULT_PRICING;
  return (promptTokens * p.input + completionTokens * p.output) / 1_000_000;
}

// ── Preview helpers ───────────────────────────────────────────────

function truncate(value: unknown, maxLen: number): string | null {
  if (value == null) return null;
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

function byteSize(value: unknown): number | null {
  if (value == null) return null;
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return Buffer.byteLength(str, 'utf8');
}

function parseEvents(raw: string): SpanEvent[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SpanEvent[];
  } catch {
    return [];
  }
}

// ── Span tree builder ─────────────────────────────────────────────

function buildSpanTree(spans: SpanRecord[], _traceStatus: string): SpanResponse[] {
  const spanMap = new Map<string, SpanResponse>();
  const roots: SpanResponse[] = [];

  for (const s of spans) {
    const attrs = JSON.parse(s.attributes) as Record<string, unknown>;
    const isTool = s.kind === 'tool' || s.name.startsWith('tool:');
    const isLlm = s.kind === 'llm';

    // ── Name resolution ──────────────────────────────────────────
    let name = s.name;
    if (isTool) {
      const toolName = attrs['tool.name'] as string | undefined;
      if (toolName) name = toolName;
      else if (s.name.startsWith('tool:')) name = s.name.slice(5);
    }

    // ── Input / Output / Error extraction ────────────────────────
    let input: unknown = null;
    let output: unknown = null;
    let errorMsg: string | null = null;

    if (isTool) {
      input = attrs['tool.input'] ?? null;
      output = attrs['tool.output'] ?? null;
      errorMsg = (attrs['tool.error'] as string) ?? null;
    }

    // Fall back to ai.* attributes (legacy / LLM spans)
    if (input == null) {
      const prompt = attrs['ai.prompt'] as string | undefined;
      const systemPrompt = attrs['ai.system_prompt'] as string | undefined;
      if (prompt || systemPrompt) {
        const inp: Record<string, unknown> = {};
        if (prompt) inp.prompt = prompt;
        if (systemPrompt) inp.systemPrompt = systemPrompt;
        input = inp;
      }
    }

    if (output == null) {
      const response = attrs['ai.response'] as string | undefined;
      if (response) output = { response };
    }

    if (!errorMsg) {
      errorMsg = (attrs['ai.error'] as string) ?? null;
    }

    // ── Model ────────────────────────────────────────────────────
    const model = (attrs['llm.model'] as string) ?? (attrs['ai.model'] as string) ?? null;

    // ── LLM-specific fields ──────────────────────────────────────
    const llmProvider = isLlm ? ((attrs['llm.provider'] as string) ?? null) : null;
    const llmStreaming =
      isLlm && attrs['llm.streaming'] != null ? Boolean(attrs['llm.streaming']) : null;
    const llmTimeToFirstTokenMs = isLlm
      ? ((attrs['llm.time_to_first_token_ms'] as number) ?? null)
      : null;

    // ── Per-span tokens & cost ───────────────────────────────────
    const promptTokens =
      (attrs['llm.prompt_tokens'] as number) ?? (attrs['ai.prompt_tokens_estimate'] as number) ?? 0;
    const completionTokens =
      (attrs['llm.completion_tokens'] as number) ??
      (attrs['ai.completion_tokens_estimate'] as number) ??
      0;
    const totalTokens = promptTokens + completionTokens;
    const hasTokens = promptTokens > 0 || completionTokens > 0;

    const explicitCost = attrs['llm.cost_usd'] as number | undefined;
    const cost =
      explicitCost ?? (hasTokens ? calcSpanCost(promptTokens, completionTokens, model) : null);

    // ── Events ───────────────────────────────────────────────────
    const events = parseEvents(s.events);

    // ── Build node ───────────────────────────────────────────────
    const node: SpanResponse = {
      id: s.id,
      traceId: s.trace_id,
      parentId: s.parent_span_id,
      name,
      kind: s.kind as SpanResponse['kind'],
      status: mapStatus(s.status),
      startTime: s.start_time,
      endTime: s.end_time,
      duration: s.duration_ms,
      input,
      output,
      error: errorMsg,
      inputPreview: truncate(input, 120),
      outputPreview: truncate(output, 120),
      inputSize: byteSize(input),
      outputSize: byteSize(output),
      tokens: hasTokens
        ? { prompt: promptTokens, completion: completionTokens, total: totalTokens }
        : null,
      cost,
      model,
      llmProvider,
      llmStreaming,
      llmTimeToFirstTokenMs,
      events,
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
      inputPreview: null,
      outputPreview: null,
      inputSize: null,
      outputSize: null,
      tokens: null,
      cost: null,
      model: null,
      llmProvider: null,
      llmStreaming: null,
      llmTimeToFirstTokenMs: null,
      events: [],
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
