/**
 * Cost Calculation Service — computes spend from trace + span data.
 *
 * Model pricing is looked up per-span (the model is stored in
 * `spans.attributes` as `ai.model`).  When no model is found on a
 * span we fall back to estimating from the trace-level token counts
 * using a default rate.
 */

import type Database from 'better-sqlite3';

// ── Pricing ───────────────────────────────────────────────────────

/** Pricing per 1 M tokens (USD). */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-opus-4.6': { input: 15, output: 75 },
  'claude-sonnet-4.6': { input: 3, output: 15 },
  'claude-haiku-4.5': { input: 0.8, output: 4 },
  'gpt-5.4': { input: 5, output: 15 },
  'gpt-5.1': { input: 2, output: 8 },
  'gpt-4.1': { input: 2, output: 8 },
};

const DEFAULT_PRICING = { input: 3, output: 15 };

function pricingFor(model: string | null): { input: number; output: number } {
  if (!model) return DEFAULT_PRICING;
  return MODEL_PRICING[model] ?? DEFAULT_PRICING;
}

function calcCost(promptTokens: number, completionTokens: number, model: string | null): number {
  const p = pricingFor(model);
  return (promptTokens * p.input + completionTokens * p.output) / 1_000_000;
}

// ── Types ─────────────────────────────────────────────────────────

export interface CostSummary {
  totalCost: number;
  totalTokens: { prompt: number; completion: number };
  byAgent: Record<string, { cost: number; tokens: number; tasks: number }>;
  byModel: Record<string, { cost: number; tokens: number; calls: number }>;
  byDay: Array<{ date: string; cost: number }>;
}

interface TraceRow {
  id: string;
  agent_name: string | null;
  prompt_tokens: number;
  completion_tokens: number;
  created_at: string;
}

interface SpanModelRow {
  trace_id: string;
  model: string | null;
}

// ── Service ───────────────────────────────────────────────────────

export class CostService {
  constructor(private readonly db: Database.Database) {}

  /**
   * Return a full cost summary, optionally scoped by period and/or agent.
   */
  getSummary(opts?: { period?: string; agentId?: string }): CostSummary {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    // Period filter
    if (opts?.period) {
      const now = new Date();
      let since: string;
      switch (opts.period) {
        case 'today': {
          since = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
          break;
        }
        case 'week': {
          const d = new Date(now);
          d.setDate(d.getDate() - 7);
          since = d.toISOString();
          break;
        }
        case 'month': {
          const d = new Date(now);
          d.setDate(d.getDate() - 30);
          since = d.toISOString();
          break;
        }
        default:
          since = '';
      }
      if (since) {
        conditions.push('t.created_at >= @since');
        params.since = since;
      }
    }

    if (opts?.agentId) {
      conditions.push('t.agent_name = @agentId');
      params.agentId = opts.agentId;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Fetch matching traces
    const traces = this.db
      .prepare(`SELECT id, agent_name, prompt_tokens, completion_tokens, created_at FROM traces ${where} ORDER BY created_at ASC`)
      .all(params) as TraceRow[];

    if (traces.length === 0) {
      return { totalCost: 0, totalTokens: { prompt: 0, completion: 0 }, byAgent: {}, byModel: {}, byDay: [] };
    }

    // Batch-fetch the dominant model per trace from spans
    const traceIds = traces.map((t) => t.id);
    const modelMap = this.fetchModelsForTraces(traceIds);

    // Accumulators
    let totalCost = 0;
    let totalPrompt = 0;
    let totalCompletion = 0;
    const byAgent: Record<string, { cost: number; tokens: number; tasks: number }> = {};
    const byModel: Record<string, { cost: number; tokens: number; calls: number }> = {};
    const dayMap: Record<string, number> = {};

    for (const t of traces) {
      const model = modelMap.get(t.id) ?? null;
      const cost = calcCost(t.prompt_tokens, t.completion_tokens, model);
      const tokens = t.prompt_tokens + t.completion_tokens;

      totalCost += cost;
      totalPrompt += t.prompt_tokens;
      totalCompletion += t.completion_tokens;

      // By agent
      const agentKey = t.agent_name || 'unknown';
      const ag = (byAgent[agentKey] ??= { cost: 0, tokens: 0, tasks: 0 });
      ag.cost += cost;
      ag.tokens += tokens;
      ag.tasks += 1;

      // By model
      const modelKey = model || 'unknown';
      const md = (byModel[modelKey] ??= { cost: 0, tokens: 0, calls: 0 });
      md.cost += cost;
      md.tokens += tokens;
      md.calls += 1;

      // By day
      const day = t.created_at.slice(0, 10); // YYYY-MM-DD
      dayMap[day] = (dayMap[day] ?? 0) + cost;
    }

    const byDay = Object.entries(dayMap).map(([date, cost]) => ({ date, cost }));

    return { totalCost, totalTokens: { prompt: totalPrompt, completion: totalCompletion }, byAgent, byModel, byDay };
  }

  // ── helpers ──────────────────────────────────────────────────────

  /**
   * For each trace id return the first non-null `ai.model` found in its spans.
   * Uses a single query to avoid N+1.
   */
  private fetchModelsForTraces(traceIds: string[]): Map<string, string> {
    const map = new Map<string, string>();
    if (traceIds.length === 0) return map;

    // SQLite doesn't support array params, so we batch in chunks
    const CHUNK = 500;
    for (let i = 0; i < traceIds.length; i += CHUNK) {
      const chunk = traceIds.slice(i, i + CHUNK);
      const placeholders = chunk.map(() => '?').join(',');
      const jsonPath = '$."ai.model"';
      const rows = this.db
        .prepare(
          `SELECT trace_id, json_extract(attributes, '${jsonPath}') AS model
           FROM spans
           WHERE trace_id IN (${placeholders})
             AND json_extract(attributes, '${jsonPath}') IS NOT NULL
           GROUP BY trace_id`,
        )
        .all(...chunk) as SpanModelRow[];

      for (const r of rows) {
        if (r.model) map.set(r.trace_id, r.model);
      }
    }

    return map;
  }
}
