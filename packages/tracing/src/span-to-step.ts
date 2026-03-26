import type { Span, Step } from './types.js';
import { SPAN_KIND_TO_STEP_TYPE } from './types.js';

/**
 * Project a Span into a UI-friendly Step.
 *
 * Steps are a computed view — they are never stored, only derived on read.
 * Input/output are extracted from well-known span attributes based on kind.
 */
export function spanToStep(span: Span, runId: string): Step {
  const type = SPAN_KIND_TO_STEP_TYPE[span.kind];

  // Extract input/output from domain-specific attributes
  const input = span.attributes['tool.input'] ?? span.attributes['llm.input'];
  const output = span.attributes['tool.output'] ?? span.attributes['llm.output'];
  const error =
    (span.attributes['tool.error'] as string | undefined) ??
    (span.events.find((e) => e.name === 'exception')?.attributes?.['exception.message'] as
      | string
      | undefined);

  return {
    stepId: span.context.spanId,
    runId,
    parentStepId: span.context.parentSpanId,
    type,
    name: span.name,
    status: span.status,
    startTime: span.startTime,
    endTime: span.endTime,
    durationMs: span.durationMs,
    input,
    output,
    error,
    tokenUsage: span.tokenUsage,
    costUsd: span.costUsd,
    metadata: span.attributes,
  };
}

/** Project all spans in a trace into an ordered list of steps. */
export function spansToSteps(spans: readonly Span[], runId: string): readonly Step[] {
  return [...spans]
    .sort((a, b) => a.startTime - b.startTime)
    .map((span) => spanToStep(span, runId));
}
