// ── Core Tracing Types ─────────────────────────────────────────────

export type SpanStatus = 'ok' | 'error' | 'unset';

export type SpanKind = 'internal' | 'tool' | 'llm' | 'agent' | 'reasoning';

export interface SpanEvent {
  readonly name: string;
  readonly timestamp: number;
  readonly attributes?: Readonly<Record<string, unknown>>;
}

export interface SpanContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
}

/** Aggregated token usage for a span or run. */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

export interface Span {
  readonly context: SpanContext;
  readonly name: string;
  readonly kind: SpanKind;
  readonly status: SpanStatus;
  readonly startTime: number;
  readonly endTime?: number;
  readonly durationMs?: number;
  readonly tokenUsage?: TokenUsage;
  readonly costUsd?: number;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly events: readonly SpanEvent[];
}

// ── Step Types ────────────────────────────────────────────────────
// A Step is a semantic view of a Span — a discrete action within a run.

export type StepType = 'reasoning' | 'tool-call' | 'llm-call' | 'agent' | 'internal';

/** Maps SpanKind → StepType for projection from spans to steps. */
export const SPAN_KIND_TO_STEP_TYPE: Readonly<Record<SpanKind, StepType>> = {
  reasoning: 'reasoning',
  tool: 'tool-call',
  llm: 'llm-call',
  agent: 'agent',
  internal: 'internal',
};

/**
 * A Step is a UI-friendly projection of a Span.
 * Steps flatten the span tree into an ordered list of discrete actions
 * (reasoning, tool calls, LLM calls) with typed input/output.
 */
export interface Step {
  readonly stepId: string;
  readonly runId: string;
  readonly parentStepId?: string;
  readonly type: StepType;
  readonly name: string;
  readonly status: SpanStatus;
  readonly startTime: number;
  readonly endTime?: number;
  readonly durationMs?: number;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: string;
  readonly tokenUsage?: TokenUsage;
  readonly costUsd?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ── Run Types ─────────────────────────────────────────────────────
// A Run is the top-level container: one agent execution from trigger to completion.

export type RunStatus = 'running' | 'completed' | 'failed' | 'cancelled';
export type RunTrigger = 'user' | 'cron' | 'webhook' | 'delegation' | 'workflow' | 'unknown';

/**
 * A Run represents a complete agent execution session.
 * It is the top-level grouping for all spans in a single trace.
 * The runId is the same as the root traceId.
 */
export interface Run {
  readonly runId: string;
  readonly agentId: string;
  readonly taskId?: string;
  readonly trigger: RunTrigger;
  readonly status: RunStatus;
  readonly startTime: number;
  readonly endTime?: number;
  readonly durationMs?: number;
  readonly tokenUsage: TokenUsage;
  readonly totalCostUsd: number;
  readonly spanCount: number;
  readonly errorMessage?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

// ── Trace (enhanced) ──────────────────────────────────────────────

/**
 * A Trace is a complete tree of spans for one run, assembled from storage.
 * Contains the run-level summary plus all child spans.
 */
export interface Trace {
  readonly traceId: string;
  readonly rootSpanId: string;
  readonly spans: readonly Span[];
  readonly startTime: number;
  readonly endTime?: number;
  readonly durationMs?: number;
  readonly tokenUsage: TokenUsage;
  readonly totalCostUsd: number;
  readonly run?: Run;
}

// ── Tool Span Attributes ──────────────────────────────────────────

export interface ToolSpanAttributes {
  readonly 'tool.id': string;
  readonly 'tool.name': string;
  readonly 'tool.input'?: unknown;
  readonly 'tool.output'?: unknown;
  readonly 'tool.error'?: string;
  readonly 'tool.duration_ms'?: number;
  readonly 'tool.input_preview'?: string;
  readonly 'tool.output_preview'?: string;
  readonly 'tool.input_size_bytes'?: number;
  readonly 'tool.output_size_bytes'?: number;
  readonly 'tool.status'?: 'success' | 'error' | 'timeout';
  readonly 'tool.retry_count'?: number;
}

// ── LLM Span Attributes ──────────────────────────────────────────

export interface LLMSpanAttributes {
  readonly 'llm.model': string;
  readonly 'llm.provider'?: string;
  readonly 'llm.prompt_tokens'?: number;
  readonly 'llm.completion_tokens'?: number;
  readonly 'llm.total_tokens'?: number;
  readonly 'llm.cost_usd'?: number;
  readonly 'llm.streaming'?: boolean;
  readonly 'llm.time_to_first_token_ms'?: number;
  readonly 'llm.total_duration_ms'?: number;
  readonly 'llm.system_prompt_preview'?: string;
  readonly 'llm.user_prompt_preview'?: string;
  readonly 'llm.response_preview'?: string;
  readonly 'llm.stop_reason'?: string;
  readonly 'llm.temperature'?: number;
  readonly 'llm.max_tokens'?: number;
}

// ── Model Pricing ─────────────────────────────────────────────────

export interface ModelPriceEntry {
  readonly model: string;
  /** Cost per 1K prompt tokens in USD */
  readonly promptPricePer1k: number;
  /** Cost per 1K completion tokens in USD */
  readonly completionPricePer1k: number;
}

export type ModelPriceTable = readonly ModelPriceEntry[];

// ── Collector Types ───────────────────────────────────────────────

export type TraceSink = (spans: readonly Span[]) => Promise<void>;

export interface TraceCollectorConfig {
  /** Max spans to buffer before auto-flush */
  readonly batchSize: number;
  /** Max ms between flushes */
  readonly flushIntervalMs: number;
  /** Where to send spans */
  readonly sink: TraceSink;
}

// ── Storage Types ─────────────────────────────────────────────────

/** Filter criteria for querying runs. */
export interface RunQuery {
  readonly agentId?: string;
  readonly taskId?: string;
  readonly status?: RunStatus;
  readonly trigger?: RunTrigger;
  /** Return runs starting after this epoch ms. */
  readonly startAfter?: number;
  /** Return runs starting before this epoch ms. */
  readonly startBefore?: number;
  /** Max results to return. Defaults to 50. */
  readonly limit?: number;
  /** Offset for pagination. */
  readonly offset?: number;
}

/**
 * TraceStore — append-only storage interface for trace data.
 *
 * Implementations can back this with SQLite (production),
 * in-memory arrays (testing), or a remote service.
 *
 * Design invariants:
 * - Spans are append-only; once written they are never mutated.
 * - Runs are upserted (status/endTime/metrics update as spans arrive).
 * - All reads are by runId (primary index) or by query filters.
 */
export interface TraceStore {
  /** Append completed spans. Idempotent on spanId. */
  appendSpans(spans: readonly Span[]): Promise<void>;

  /** Upsert a run record (created on first span, updated on completion). */
  upsertRun(run: Run): Promise<void>;

  /** Retrieve a full trace (all spans) for a given run. */
  getTrace(runId: string): Promise<Trace | undefined>;

  /** List runs matching the given query filters. */
  listRuns(query?: RunQuery): Promise<readonly Run[]>;

  /** Delete runs older than the given epoch ms. Returns count deleted. */
  pruneRunsBefore(epochMs: number): Promise<number>;
}

// ── Tracer Config ─────────────────────────────────────────────────

export interface TracerConfig {
  /** Service/agent name for attribution */
  readonly serviceName: string;
  /** Optional collector to auto-submit spans */
  readonly collector?: TraceCollectorHandle;
}

export interface TraceCollectorHandle {
  submit(span: Span): void;
}

// ── Instrumentation types ─────────────────────────────────────────

export interface ToolCallOptions<TInput, TOutput> {
  readonly toolId: string;
  readonly toolName: string;
  readonly fn: (input: TInput) => Promise<TOutput>;
  /** Timeout in ms — if exceeded, span is marked with tool.status='timeout'. */
  readonly timeoutMs?: number;
  /** Number of retries already attempted (0 = first try). */
  readonly retryCount?: number;
}

export interface LLMCallOptions<TInput, TOutput> {
  readonly model: string;
  readonly provider?: string;
  readonly fn: (input: TInput) => Promise<TOutput>;
  /** Extract token usage from the LLM response */
  readonly extractUsage?: (output: TOutput) => {
    promptTokens?: number;
    completionTokens?: number;
  };
  /** Whether the call uses streaming */
  readonly streaming?: boolean;
  /** Extract the stop/finish reason from the LLM response */
  readonly extractStopReason?: (output: TOutput) => string | undefined;
  /** Extract the response text for preview */
  readonly extractResponse?: (output: TOutput) => string | undefined;
  /** Temperature used for the call */
  readonly temperature?: number;
  /** Max tokens parameter */
  readonly maxTokens?: number;
  /** System prompt (for preview capture) */
  readonly systemPrompt?: string;
  /** Callback invoked on first token for streaming TTFT measurement */
  readonly onFirstToken?: (callback: () => void) => void;
}

// ── Agent Span Attributes ──────────────────────────────────────────

export interface AgentSpanAttributes {
  readonly 'agent.name': string;
  readonly 'agent.goal'?: string;
  readonly 'agent.step_count'?: number;
  readonly 'agent.outcome'?: 'success' | 'error' | 'cancelled' | 'timeout';
  readonly 'agent.duration_ms'?: number;
}

export interface AgentSpanOptions {
  readonly agentName: string;
  readonly goal?: string;
}
