import type { Tracer } from './tracer.js';
import type { ToolCallOptions } from './types.js';

/**
 * Wrap a tool call function with automatic tracing instrumentation.
 *
 * Returns a new function with the same signature that:
 * - Creates a 'tool' span with the tool's id and name
 * - Records input as an attribute (plus byte size and parameter count)
 * - Records output or error (plus byte size)
 * - Captures latency
 *
 * @example
 * ```ts
 * const traced = instrumentToolCall(tracer, {
 *   toolId: 'search-web',
 *   toolName: 'Web Search',
 *   fn: async (query: string) => searchWeb(query),
 * });
 * const results = await traced('openspace AI');
 * ```
 */
export function instrumentToolCall<TInput, TOutput>(
  tracer: Tracer,
  options: ToolCallOptions<TInput, TOutput>,
): (input: TInput) => Promise<TOutput> {
  const { toolId, toolName, fn } = options;

  return async (input: TInput): Promise<TOutput> => {
    const inputStr = JSON.stringify(input);
    const paramCount =
      input && typeof input === 'object' && !Array.isArray(input)
        ? Object.keys(input as Record<string, unknown>).length
        : null;
    const attrs: Record<string, unknown> = {
      'tool.id': toolId,
      'tool.name': toolName,
      'tool.input': input,
      'tool.input_bytes': new TextEncoder().encode(inputStr).length,
      ...(paramCount !== null ? { 'tool.parameter_count': paramCount } : {}),
    };

    return tracer.withSpan(
      `tool:${toolName}`,
      'tool',
      async (ctx) => {
        const start = performance.now();
        try {
          const output = await fn(input);
          const durationMs = performance.now() - start;
          const outputStr = JSON.stringify(output);
          tracer.setAttributes(ctx.spanId, {
            'tool.output': output,
            'tool.duration_ms': Math.round(durationMs * 100) / 100,
            'tool.output_bytes': new TextEncoder().encode(outputStr).length,
          });
          return output;
        } catch (err) {
          const durationMs = performance.now() - start;
          tracer.setAttributes(ctx.spanId, {
            'tool.error': err instanceof Error ? err.message : String(err),
            'tool.duration_ms': Math.round(durationMs * 100) / 100,
          });
          throw err;
        }
      },
      attrs,
    );
  };
}
