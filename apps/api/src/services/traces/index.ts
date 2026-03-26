/**
 * Trace Service — records AI interactions into the SQLite traces + spans tables.
 *
 * Used by CopilotProvider to persist every AI call so the frontend
 * /traces UI can display real data instead of mocks.
 */

import { randomUUID } from 'node:crypto';

import type Database from 'better-sqlite3';

// ── Types ─────────────────────────────────────────────────────────

export interface TraceRecord {
  id: string;
  root_span_name: string;
  agent_name: string | null;
  status: string;
  start_time: number;
  end_time: number | null;
  duration_ms: number | null;
  span_count: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_usd: number;
  error_message: string | null;
  created_at: string;
}

export interface SpanRecord {
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

export interface CreateTraceInput {
  agentId?: string;
  taskTitle?: string;
  model: string;
  systemPrompt?: string;
  prompt: string;
}

export interface CompleteTraceInput {
  response: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

// ── Service ───────────────────────────────────────────────────────

export class TraceService {
  private readonly insertTrace: Database.Statement;
  private readonly insertSpan: Database.Statement;
  private readonly updateTraceComplete: Database.Statement;
  private readonly updateTraceError: Database.Statement;
  private readonly updateSpanComplete: Database.Statement;
  private readonly updateSpanError: Database.Statement;
  private readonly selectTraces: Database.Statement;
  private readonly selectTraceById: Database.Statement;
  private readonly selectSpansByTrace: Database.Statement;
  private readonly selectTraceStats: Database.Statement;

  constructor(private readonly db: Database.Database) {
    this.insertTrace = db.prepare(`
      INSERT INTO traces (id, root_span_name, agent_name, status, start_time, end_time, duration_ms,
        span_count, total_tokens, prompt_tokens, completion_tokens, cost_usd, error_message, created_at)
      VALUES (@id, @root_span_name, @agent_name, @status, @start_time, @end_time, @duration_ms,
        @span_count, @total_tokens, @prompt_tokens, @completion_tokens, @cost_usd, @error_message, @created_at)
    `);

    this.insertSpan = db.prepare(`
      INSERT INTO spans (id, trace_id, parent_span_id, name, kind, status, start_time, end_time, duration_ms, attributes, events)
      VALUES (@id, @trace_id, @parent_span_id, @name, @kind, @status, @start_time, @end_time, @duration_ms, @attributes, @events)
    `);

    this.updateTraceComplete = db.prepare(`
      UPDATE traces
      SET status = 'completed', end_time = @end_time, duration_ms = @duration_ms,
          total_tokens = @total_tokens, prompt_tokens = @prompt_tokens,
          completion_tokens = @completion_tokens, cost_usd = @cost_usd
      WHERE id = @id
    `);

    this.updateTraceError = db.prepare(`
      UPDATE traces
      SET status = 'error', end_time = @end_time, duration_ms = @duration_ms,
          error_message = @error_message
      WHERE id = @id
    `);

    this.updateSpanComplete = db.prepare(`
      UPDATE spans
      SET status = 'completed', end_time = @end_time, duration_ms = @duration_ms,
          attributes = @attributes
      WHERE id = @id
    `);

    this.updateSpanError = db.prepare(`
      UPDATE spans
      SET status = 'error', end_time = @end_time, duration_ms = @duration_ms,
          attributes = @attributes
      WHERE id = @id
    `);

    this.selectTraces = db.prepare(`
      SELECT * FROM traces ORDER BY start_time DESC LIMIT @limit
    `);

    this.selectTraceById = db.prepare(`
      SELECT * FROM traces WHERE id = @id
    `);

    this.selectSpansByTrace = db.prepare(`
      SELECT * FROM spans WHERE trace_id = @trace_id ORDER BY start_time ASC
    `);

    this.selectTraceStats = db.prepare(`
      SELECT
        COUNT(*) as total_traces,
        COALESCE(AVG(duration_ms), 0) as avg_latency,
        COALESCE(SUM(cost_usd), 0) as total_cost,
        COALESCE(SUM(total_tokens), 0) as total_tokens,
        COALESCE(SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END), 0) as error_count
      FROM traces
    `);
  }

  /**
   * Start a new trace when an AI request begins.
   * Returns { traceId, spanId } so the caller can complete/fail it later.
   */
  startTrace(input: CreateTraceInput): { traceId: string; spanId: string } {
    const traceId = randomUUID();
    const spanId = randomUUID();
    const now = Date.now();
    const createdAt = new Date(now).toISOString();

    const spanName = input.taskTitle
      ? `${input.agentId ?? 'unknown'}:${input.taskTitle}`
      : `${input.agentId ?? 'completion'}`;

    this.insertTrace.run({
      id: traceId,
      root_span_name: spanName,
      agent_name: input.agentId ?? null,
      status: 'pending',
      start_time: now,
      end_time: null,
      duration_ms: null,
      span_count: 1,
      total_tokens: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      cost_usd: 0,
      error_message: null,
      created_at: createdAt,
    });

    const attributes = JSON.stringify({
      'ai.model': input.model,
      'ai.agent_id': input.agentId ?? 'unknown',
      'ai.task_title': input.taskTitle ?? '',
      'ai.prompt': input.prompt,
      'ai.system_prompt': input.systemPrompt ?? '',
    });

    this.insertSpan.run({
      id: spanId,
      trace_id: traceId,
      parent_span_id: null,
      name: spanName,
      kind: 'llm',
      status: 'pending',
      start_time: now,
      end_time: null,
      duration_ms: null,
      attributes,
      events: '[]',
    });

    return { traceId, spanId };
  }

  /**
   * Mark a trace as completed with the AI response.
   */
  completeTrace(traceId: string, spanId: string, input: CompleteTraceInput): void {
    const now = Date.now();
    const trace = this.selectTraceById.get({ id: traceId }) as TraceRecord | undefined;
    if (!trace) return;

    const durationMs = now - trace.start_time;
    const promptTokens = input.promptTokens ?? 0;
    const completionTokens = input.completionTokens ?? 0;
    const totalTokens = promptTokens + completionTokens;

    this.updateTraceComplete.run({
      id: traceId,
      end_time: now,
      duration_ms: durationMs,
      total_tokens: totalTokens,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      cost_usd: 0,
    });

    // Update span with response in attributes
    const existingSpan = this.selectSpansByTrace
      .all({ trace_id: traceId })
      .find((s) => (s as SpanRecord).id === spanId) as SpanRecord | undefined;

    const existingAttrs = existingSpan
      ? (JSON.parse(existingSpan.attributes) as Record<string, unknown>)
      : {};
    existingAttrs['ai.response'] = input.response;
    existingAttrs['ai.model'] = input.model;

    this.updateSpanComplete.run({
      id: spanId,
      end_time: now,
      duration_ms: durationMs,
      attributes: JSON.stringify(existingAttrs),
    });
  }

  /**
   * Mark a trace as failed with an error message.
   */
  failTrace(traceId: string, spanId: string, errorMessage: string): void {
    const now = Date.now();
    const trace = this.selectTraceById.get({ id: traceId }) as TraceRecord | undefined;
    if (!trace) return;

    const durationMs = now - trace.start_time;

    this.updateTraceError.run({
      id: traceId,
      end_time: now,
      duration_ms: durationMs,
      error_message: errorMessage,
    });

    const existingSpan = this.selectSpansByTrace
      .all({ trace_id: traceId })
      .find((s) => (s as SpanRecord).id === spanId) as SpanRecord | undefined;

    const existingAttrs = existingSpan
      ? (JSON.parse(existingSpan.attributes) as Record<string, unknown>)
      : {};
    existingAttrs['ai.error'] = errorMessage;

    this.updateSpanError.run({
      id: spanId,
      end_time: now,
      duration_ms: durationMs,
      attributes: JSON.stringify(existingAttrs),
    });
  }

  // ── Query methods ─────────────────────────────────────────────────

  /**
   * List traces with optional filters. Returns newest first.
   */
  listTraces(opts?: { limit?: number; agent?: string; status?: string }): TraceRecord[] {
    const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 500);

    if (opts?.agent && opts?.status) {
      return this.db
        .prepare(
          `SELECT * FROM traces WHERE agent_name = @agent AND status = @status ORDER BY start_time DESC LIMIT @limit`,
        )
        .all({ agent: opts.agent, status: opts.status, limit }) as TraceRecord[];
    }

    if (opts?.agent) {
      return this.db
        .prepare(
          `SELECT * FROM traces WHERE agent_name = @agent ORDER BY start_time DESC LIMIT @limit`,
        )
        .all({ agent: opts.agent, limit }) as TraceRecord[];
    }

    if (opts?.status) {
      return this.db
        .prepare(
          `SELECT * FROM traces WHERE status = @status ORDER BY start_time DESC LIMIT @limit`,
        )
        .all({ status: opts.status, limit }) as TraceRecord[];
    }

    return this.selectTraces.all({ limit }) as TraceRecord[];
  }

  /**
   * Get a single trace with all its spans.
   */
  getTrace(traceId: string): { trace: TraceRecord; spans: SpanRecord[] } | null {
    const trace = this.selectTraceById.get({ id: traceId }) as TraceRecord | undefined;
    if (!trace) return null;

    const spans = this.selectSpansByTrace.all({ trace_id: traceId }) as SpanRecord[];
    return { trace, spans };
  }

  /**
   * Get aggregate statistics across all traces.
   */
  getStats(): {
    totalTraces: number;
    avgLatency: number;
    totalCost: number;
    totalTokens: number;
    errorRate: number;
  } {
    const row = this.selectTraceStats.get() as {
      total_traces: number;
      avg_latency: number;
      total_cost: number;
      total_tokens: number;
      error_count: number;
    };

    return {
      totalTraces: row.total_traces,
      avgLatency: Math.round(row.avg_latency),
      totalCost: row.total_cost,
      totalTokens: row.total_tokens,
      errorRate: row.total_traces > 0 ? row.error_count / row.total_traces : 0,
    };
  }
}
