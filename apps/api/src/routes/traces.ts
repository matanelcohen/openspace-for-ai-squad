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

interface SpanEventResponse {
  name: string;
  timestamp: number;
  attributes?: Record<string, unknown>;
}

interface ToolInfoResponse {
  durationMs: number | null;
  parameterCount: number | null;
  inputBytes: number | null;
  outputBytes: number | null;
  customAttributes: Record<string, unknown>;
}

interface LlmInfoResponse {
  messageCount: number | null;
  responseLength: number | null;
  tokensPerSecond: number | null;
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
  toolName: string | null;
  toolId: string | null;
  events: SpanEventResponse[];
  toolInfo: ToolInfoResponse | null;
  llmInfo: LlmInfoResponse | null;
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

    // Tool attributes
    const toolName = (attrs['tool.name'] as string) ?? null;
    const toolId = (attrs['tool.id'] as string) ?? null;
    const toolInput = attrs['tool.input'];
    const toolOutput = attrs['tool.output'];

    // Build input — fallback to tool attributes when ai.prompt is missing
    const input: Record<string, unknown> = {};
    if (prompt) input.prompt = prompt;
    if (systemPrompt) input.systemPrompt = systemPrompt;
    if (toolInput !== undefined) input.toolInput = toolInput;

    let resolvedInput: unknown;
    if (Object.keys(input).length > 0) {
      resolvedInput = input;
    } else if (s.kind === 'tool' && (toolName || toolId)) {
      // Structured fallback for tool spans with no explicit input
      const fallback: Record<string, unknown> = {};
      if (toolName) fallback.toolName = toolName;
      if (toolId) fallback.toolId = toolId;
      for (const [key, val] of Object.entries(attrs)) {
        if (
          key.startsWith('tool.') &&
          ![
            'tool.name',
            'tool.id',
            'tool.input',
            'tool.output',
            'tool.error',
            'tool.duration_ms',
          ].includes(key)
        ) {
          fallback[key] = val;
        }
      }
      resolvedInput = fallback;
    } else {
      resolvedInput = null;
    }

    // Build output — fallback for tool spans
    let resolvedOutput: unknown;
    if (response) {
      resolvedOutput = { response };
    } else if (toolOutput !== undefined) {
      resolvedOutput = { toolOutput };
    } else {
      resolvedOutput = null;
    }

    // Parse ALL span events
    const events: SpanEventResponse[] = [];
    if (s.events) {
      try {
        const rawEvents = JSON.parse(s.events) as Array<{
          name?: string;
          timestamp?: number;
          attributes?: Record<string, unknown>;
        }>;
        for (const evt of rawEvents) {
          if (evt && typeof evt === 'object' && evt.name) {
            events.push({
              name: evt.name,
              timestamp: evt.timestamp ?? 0,
              ...(evt.attributes && Object.keys(evt.attributes).length > 0
                ? { attributes: evt.attributes }
                : {}),
            });
          }
        }
      } catch {
        // Malformed events JSON — skip
      }
    }

    // Build toolInfo for tool spans
    let toolInfo: ToolInfoResponse | null = null;
    if (s.kind === 'tool') {
      const customAttributes: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(attrs)) {
        if (
          key.startsWith('tool.') &&
          ![
            'tool.name',
            'tool.id',
            'tool.input',
            'tool.output',
            'tool.error',
            'tool.duration_ms',
          ].includes(key)
        ) {
          customAttributes[key] = val;
        }
      }
      const inputStr = toolInput !== undefined ? JSON.stringify(toolInput) : null;
      const outputStr = toolOutput !== undefined ? JSON.stringify(toolOutput) : null;
      const paramCount =
        toolInput && typeof toolInput === 'object' && !Array.isArray(toolInput)
          ? Object.keys(toolInput as Record<string, unknown>).length
          : null;

      toolInfo = {
        durationMs: (attrs['tool.duration_ms'] as number) ?? null,
        parameterCount: paramCount,
        inputBytes: inputStr ? new TextEncoder().encode(inputStr).length : null,
        outputBytes: outputStr ? new TextEncoder().encode(outputStr).length : null,
        customAttributes,
      };
    }

    // Build llmInfo for LLM spans
    let llmInfo: LlmInfoResponse | null = null;
    if (s.kind === 'llm') {
      let messageCount: number | null = null;
      if (prompt) {
        try {
          const parsed = JSON.parse(prompt);
          if (Array.isArray(parsed)) {
            messageCount = parsed.length;
          }
        } catch {
          messageCount = 1;
        }
      }

      const responseLength = response ? response.length : null;

      let tokensPerSecond: number | null = null;
      const completionTokens =
        (attrs['llm.completion_tokens'] as number) ??
        (attrs['ai.completion_tokens'] as number) ??
        null;
      const durationMs = s.duration_ms;
      if (completionTokens && durationMs && durationMs > 0) {
        tokensPerSecond = Math.round((completionTokens / (durationMs / 1000)) * 100) / 100;
      }

      llmInfo = { messageCount, responseLength, tokensPerSecond };
    }

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
      input: resolvedInput,
      output: resolvedOutput,
      error: errorMsg ?? (attrs['tool.error'] as string) ?? null,
      tokens: null,
      cost: null,
      model: model ?? null,
      metadata: attrs,
      children: [],
      toolName,
      toolId,
      events,
      toolInfo,
      llmInfo,
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
      toolName: null,
      toolId: null,
      events: [],
      toolInfo: null,
      llmInfo: null,
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

// ── Exported for testing ─────────────────────────────────────────
export { buildSpanTree, mapStatus, toTraceSummary };
export type {
  LlmInfoResponse,
  SpanEventResponse,
  SpanResponse,
  ToolInfoResponse,
  TraceSummaryResponse,
};

// ── Fastify type augmentation ────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    traceService: TraceService;
  }
}
