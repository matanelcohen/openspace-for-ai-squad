import type { Tracer } from './tracer.js';
import type { ToolCallOptions, ToolSpanAttributes } from './types.js';

/**
 * Wrap a tool call function with automatic tracing instrumentation.
 *
 * Returns a new function with the same signature that:
 * - Creates a 'tool' span with the tool's id and name
 * - Records input as an attribute
 * - Records output or error
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
    const attrs: Record<string, unknown> = {
      'tool.id': toolId,
      'tool.name': toolName,
      'tool.input': input,
    } satisfies Partial<Record<keyof ToolSpanAttributes, unknown>>;

    return tracer.withSpan(
      `tool:${toolName}`,
      'tool',
      async (ctx) => {
        const start = performance.now();
        try {
          const output = await fn(input);
          const durationMs = performance.now() - start;
          const inputSizeBytes = (() => {
            try {
              return JSON.stringify(input)?.length ?? 0;
            } catch {
              return 0;
            }
          })();
          const outputSizeBytes = (() => {
            try {
              return JSON.stringify(output)?.length ?? 0;
            } catch {
              return 0;
            }
          })();
          tracer.setAttributes(ctx.spanId, {
            'tool.output': output,
            'tool.duration_ms': Math.round(durationMs * 100) / 100,
            'tool.input_size_bytes': inputSizeBytes,
            'tool.output_size_bytes': outputSizeBytes,
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
