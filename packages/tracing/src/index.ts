/**
 * @matanelcohen/openspace-tracing — Tracing SDK & instrumentation layer.
 *
 * Provides span-based tracing for agent workflows with automatic
 * instrumentation for tool calls and LLM invocations, cost tracking,
 * and batch persistence via a configurable collector.
 */

// ── Types ──────────────────────────────────────────────────────────
export type {
  AgentSpanAttributes,
  AgentSpanOptions,
  LLMCallOptions,
  LLMSpanAttributes,
  ModelPriceEntry,
  ModelPriceTable,
  Run,
  RunQuery,
  RunStatus,
  RunTrigger,
  Span,
  SpanContext,
  SpanEvent,
  SpanKind,
  SpanStatus,
  Step,
  StepType,
  TokenUsage,
  ToolCallOptions,
  ToolSpanAttributes,
  Trace,
  TraceCollectorConfig,
  TraceCollectorHandle,
  TracerConfig,
  TraceSink,
  TraceStore,
} from './types.js';
export { SPAN_KIND_TO_STEP_TYPE } from './types.js';

// ── Span Context / Propagation ────────────────────────────────────
export {
  generateId,
  generateSpanId,
  generateTraceId,
  getActiveContext,
  runWithContext,
} from './span-context.js';

// ── Tracer ─────────────────────────────────────────────────────────
export { Tracer } from './tracer.js';

// ── Trace Collector ────────────────────────────────────────────────
export { TraceCollector } from './trace-collector.js';

// ── Instrumentation ────────────────────────────────────────────────
export { instrumentAgentSpan } from './instrument-agent.js';
export { instrumentLLMCall } from './instrument-llm.js';
export { instrumentToolCall } from './instrument-tool.js';

// ── Cost Calculator ────────────────────────────────────────────────
export { calculateCost, DEFAULT_PRICE_TABLE, findPriceEntry } from './cost-calculator.js';

// ── Trace Store ───────────────────────────────────────────────────
export {
  aggregateCost,
  aggregateTokenUsage,
  buildTrace,
  InMemoryTraceStore,
} from './trace-store.js';

// ── Span → Step Projection ───────────────────────────────────────
export { spansToSteps, spanToStep } from './span-to-step.js';
