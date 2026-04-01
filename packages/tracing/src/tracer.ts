import {
  generateSpanId,
  generateTraceId,
  getActiveContext,
  runWithContext,
} from './span-context.js';
import type {
  Span,
  SpanContext,
  SpanEvent,
  SpanKind,
  SpanStatus,
  TraceCollectorHandle,
  TracerConfig,
} from './types.js';

// ── Mutable span used internally during recording ─────────────────

interface MutableSpan {
  context: SpanContext;
  name: string;
  kind: SpanKind;
  status: SpanStatus;
  startTime: number;
  endTime?: number;
  attributes: Record<string, unknown>;
  events: SpanEvent[];
}

/**
 * Tracer — the main API agents use to emit spans.
 *
 * Spans automatically form a tree via AsyncLocalStorage-based context propagation.
 * When a span is started inside `withSpan()`, it inherits the parent's traceId
 * and sets parentSpanId accordingly.
 */
export class Tracer {
  private readonly serviceName: string;
  private readonly collector?: TraceCollectorHandle;
  private readonly activeSpans = new Map<string, MutableSpan>();

  constructor(config: TracerConfig) {
    this.serviceName = config.serviceName;
    this.collector = config.collector;
  }

  /**
   * Start a new span. If called inside an active context, the span becomes
   * a child of the current span. Returns the SpanContext for the new span.
   */
  startSpan(
    name: string,
    kind: SpanKind = 'internal',
    attributes: Record<string, unknown> = {},
  ): SpanContext {
    const parent = getActiveContext();
    const traceId = parent?.traceId ?? generateTraceId();
    const spanId = generateSpanId();

    const ctx: SpanContext = {
      traceId,
      spanId,
      parentSpanId: parent?.spanId,
    };

    const span: MutableSpan = {
      context: ctx,
      name,
      kind,
      status: 'unset',
      startTime: Date.now(),
      attributes: { 'service.name': this.serviceName, ...attributes },
      events: [],
    };

    this.activeSpans.set(spanId, span);
    return ctx;
  }

  /** Record an event on an active span. */
  recordEvent(
    spanId: string,
    name: string,
    attributes?: Record<string, unknown>,
  ): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;
    span.events.push({ name, timestamp: Date.now(), attributes });
  }

  /** Set attributes on an active span (merges with existing). */
  setAttributes(spanId: string, attributes: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) return;
    Object.assign(span.attributes, attributes);
  }

  /** End a span and optionally set its status. Returns the frozen Span. */
  endSpan(spanId: string, status: SpanStatus = 'ok'): Span | undefined {
    const span = this.activeSpans.get(spanId);
    if (!span) return undefined;

    span.endTime = Date.now();
    span.status = status;
    this.activeSpans.delete(spanId);

    const durationMs = span.endTime !== undefined
      ? span.endTime - span.startTime
      : undefined;

    // Promote LLM token/cost attributes to first-class fields
    const promptTokens = span.attributes['llm.prompt_tokens'];
    const completionTokens = span.attributes['llm.completion_tokens'];
    const tokenUsage =
      typeof promptTokens === 'number' && typeof completionTokens === 'number'
        ? {
            promptTokens,
            completionTokens,
            totalTokens: promptTokens + completionTokens,
          }
        : undefined;

    const costAttr = span.attributes['llm.cost_usd'];
    const costUsd = typeof costAttr === 'number' ? costAttr : undefined;

    const frozen: Span = {
      context: span.context,
      name: span.name,
      kind: span.kind,
      status: span.status,
      startTime: span.startTime,
      endTime: span.endTime,
      durationMs,
      tokenUsage,
      costUsd,
      attributes: { ...span.attributes },
      events: [...span.events],
    };

    this.collector?.submit(frozen);
    return frozen;
  }

  /**
   * Convenience: run `fn` inside a new span with automatic context propagation.
   * The span is ended when `fn` resolves or rejects.
   */
  async withSpan<T>(
    name: string,
    kind: SpanKind,
    fn: (ctx: SpanContext) => Promise<T>,
    attributes?: Record<string, unknown>,
  ): Promise<T> {
    const ctx = this.startSpan(name, kind, attributes);
    return runWithContext(ctx, async () => {
      try {
        const result = await fn(ctx);
        this.endSpan(ctx.spanId, 'ok');
        return result;
      } catch (err) {
        const isTimeout =
          err instanceof Error &&
          /timed?\s*out|timeout|deadline exceeded/i.test(err.message);

        const exceptionAttrs: Record<string, unknown> = {
          'exception.message':
            err instanceof Error ? err.message : String(err),
        };

        if (err instanceof Error && err.stack) {
          exceptionAttrs['exception.stacktrace'] = err.stack;
        }

        if (isTimeout) {
          exceptionAttrs['exception.type'] = 'TimeoutError';
        } else if (err instanceof Error) {
          exceptionAttrs['exception.type'] = err.constructor.name;
        }

        this.recordEvent(ctx.spanId, 'exception', exceptionAttrs);
        this.endSpan(ctx.spanId, 'error');
        throw err;
      }
    });
  }

  /** Get a snapshot of currently active spans (for diagnostics). */
  getActiveSpanCount(): number {
    return this.activeSpans.size;
  }
}
