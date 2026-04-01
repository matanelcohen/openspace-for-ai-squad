import type { Tracer } from './tracer.js';
import type { AgentSpanAttributes, AgentSpanOptions } from './types.js';

/**
 * Wrap an agent execution with automatic tracing instrumentation.
 *
 * Creates an 'agent' span that tracks the full lifecycle of an agent,
 * including its name, goal/task description, number of steps, and outcome.
 *
 * The `fn` callback receives a `step()` function to increment the step counter,
 * which is recorded as `agent.step_count` when the span completes.
 *
 * @example
 * ```ts
 * const result = await instrumentAgentSpan(tracer, {
 *   agentName: 'researcher',
 *   goal: 'Summarize recent papers on LLMs',
 * }, async (step) => {
 *   step(); // search
 *   const results = await searchWeb('LLM papers 2025');
 *   step(); // summarize
 *   const summary = await llm('Summarize these papers...');
 *   return summary;
 * });
 * ```
 */
export async function instrumentAgentSpan<T>(
  tracer: Tracer,
  options: AgentSpanOptions,
  fn: (step: () => void) => Promise<T>,
): Promise<T> {
  const { agentName, goal } = options;

  const attrs: Record<string, unknown> = {
    'agent.name': agentName,
    ...(goal && { 'agent.goal': goal }),
  } satisfies Partial<Record<keyof AgentSpanAttributes, unknown>>;

  return tracer.withSpan(
    `agent:${agentName}`,
    'agent',
    async (ctx) => {
      const start = performance.now();
      let stepCount = 0;

      const step = () => {
        stepCount++;
      };

      try {
        const result = await fn(step);
        const durationMs = performance.now() - start;

        tracer.setAttributes(ctx.spanId, {
          'agent.step_count': stepCount,
          'agent.outcome': 'success',
          'agent.duration_ms': Math.round(durationMs * 100) / 100,
        });

        return result;
      } catch (err) {
        const durationMs = performance.now() - start;
        const isTimeout =
          err instanceof Error &&
          (err.message.includes('timed out') || err.message.includes('timeout'));

        tracer.setAttributes(ctx.spanId, {
          'agent.step_count': stepCount,
          'agent.outcome': isTimeout ? 'timeout' : 'error',
          'agent.duration_ms': Math.round(durationMs * 100) / 100,
        });

        throw err;
      }
    },
    attrs,
  );
}
