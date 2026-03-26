import type { Run, RunQuery, Span, TokenUsage, Trace, TraceStore } from './types.js';

// ── Helpers ───────────────────────────────────────────────────────

/** Aggregate token usage across a set of spans (LLM spans only). */
export function aggregateTokenUsage(spans: readonly Span[]): TokenUsage {
  let promptTokens = 0;
  let completionTokens = 0;
  for (const span of spans) {
    if (span.tokenUsage) {
      promptTokens += span.tokenUsage.promptTokens;
      completionTokens += span.tokenUsage.completionTokens;
    }
  }
  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
}

/** Aggregate cost across a set of spans. */
export function aggregateCost(spans: readonly Span[]): number {
  let total = 0;
  for (const span of spans) {
    if (span.costUsd !== undefined) {
      total += span.costUsd;
    }
  }
  return Math.round(total * 1e8) / 1e8;
}

/** Build a Trace object from a set of spans sharing a traceId. */
export function buildTrace(traceId: string, spans: readonly Span[], run?: Run): Trace | undefined {
  if (spans.length === 0) return undefined;

  const sorted = [...spans].sort((a, b) => a.startTime - b.startTime);
  const rootSpan = sorted.find((s) => !s.context.parentSpanId) ?? sorted[0]!;

  const startTime = sorted[0]!.startTime;
  const endTimes = sorted.map((s) => s.endTime).filter((t): t is number => t !== undefined);
  const endTime = endTimes.length > 0 ? Math.max(...endTimes) : undefined;

  const tokenUsage = aggregateTokenUsage(spans);
  const totalCostUsd = aggregateCost(spans);

  return {
    traceId,
    rootSpanId: rootSpan.context.spanId,
    spans: sorted,
    startTime,
    endTime,
    durationMs: endTime !== undefined ? endTime - startTime : undefined,
    tokenUsage,
    totalCostUsd,
    run,
  };
}

// ── InMemoryTraceStore ────────────────────────────────────────────

/**
 * In-memory implementation of TraceStore for testing and development.
 *
 * Production deployments should use a SQLite-backed implementation
 * (see ADR for schema design).
 */
export class InMemoryTraceStore implements TraceStore {
  private readonly spans = new Map<string, Span[]>();
  private readonly runs = new Map<string, Run>();

  async appendSpans(spans: readonly Span[]): Promise<void> {
    for (const span of spans) {
      const traceId = span.context.traceId;
      const existing = this.spans.get(traceId) ?? [];
      // Idempotent: skip if spanId already present
      if (existing.some((s) => s.context.spanId === span.context.spanId)) continue;
      existing.push(span);
      this.spans.set(traceId, existing);
    }
  }

  async upsertRun(run: Run): Promise<void> {
    this.runs.set(run.runId, run);
  }

  async getTrace(runId: string): Promise<Trace | undefined> {
    const spans = this.spans.get(runId);
    if (!spans || spans.length === 0) return undefined;
    const run = this.runs.get(runId);
    return buildTrace(runId, spans, run);
  }

  async listRuns(query?: RunQuery): Promise<readonly Run[]> {
    let results = Array.from(this.runs.values());

    if (query?.agentId) results = results.filter((r) => r.agentId === query.agentId);
    if (query?.taskId) results = results.filter((r) => r.taskId === query.taskId);
    if (query?.status) results = results.filter((r) => r.status === query.status);
    if (query?.trigger) results = results.filter((r) => r.trigger === query.trigger);
    if (query?.startAfter) results = results.filter((r) => r.startTime > query.startAfter!);
    if (query?.startBefore) results = results.filter((r) => r.startTime < query.startBefore!);

    // Sort by startTime descending (most recent first)
    results.sort((a, b) => b.startTime - a.startTime);

    const offset = query?.offset ?? 0;
    const limit = query?.limit ?? 50;
    return results.slice(offset, offset + limit);
  }

  async pruneRunsBefore(epochMs: number): Promise<number> {
    let count = 0;
    for (const [runId, run] of this.runs) {
      if (run.startTime < epochMs) {
        this.runs.delete(runId);
        this.spans.delete(runId);
        count++;
      }
    }
    return count;
  }

  /** Get current counts for diagnostics. */
  get stats(): { runCount: number; spanCount: number } {
    let spanCount = 0;
    for (const spans of this.spans.values()) spanCount += spans.length;
    return { runCount: this.runs.size, spanCount };
  }
}
