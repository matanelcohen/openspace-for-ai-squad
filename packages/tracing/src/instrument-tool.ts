import type { Tracer } from './tracer.js';
import type { ToolCallOptions, ToolSpanAttributes } from './types.js';

// ── Helpers ────────────────────────────────────────────────────────

/** Produce a truncated human-readable preview of data (max `maxLen` chars). */
function makePreview(data: unknown, maxLen = 200): string | undefined {
  if (data == null) return undefined;
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

/** Estimate byte size of a value (JSON-serialized length). */
function estimateBytes(data: unknown): number {
  if (data == null) return 0;
  if (typeof data === 'string') return new TextEncoder().encode(data).byteLength;
  try {
    return new TextEncoder().encode(JSON.stringify(data)).byteLength;
  } catch {
    return 0;
  }
}

/**
 * Wrap a tool call function with automatic tracing instrumentation.
 *
 * Returns a new function with the same signature that:
 * - Creates a 'tool' span with the tool's id and name
 * - Records input as an attribute
 * - Records output or error
 * - Captures latency
 * - Adds preview and size attributes for observability
 * - Tracks tool.status and tool.retry_count
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
  const { toolId, toolName, fn, timeoutMs, retryCount } = options;

  return async (input: TInput): Promise<TOutput> => {
    const inputPreview = makePreview(input);
    const inputSizeBytes = estimateBytes(input);

    const attrs: Record<string, unknown> = {
      'tool.id': toolId,
      'tool.name': toolName,
      'tool.input': input,
      ...(inputPreview !== undefined && { 'tool.input_preview': inputPreview }),
      ...(inputSizeBytes > 0 && { 'tool.input_size_bytes': inputSizeBytes }),
      ...(retryCount !== undefined && retryCount > 0 && { 'tool.retry_count': retryCount }),
    } satisfies Partial<Record<keyof ToolSpanAttributes, unknown>>;

    return tracer.withSpan(
      `tool:${toolName}`,
      'tool',
      async (ctx) => {
        const start = performance.now();

        // If timeoutMs is set, race the fn against a timeout
        const execute = timeoutMs
          ? Promise.race([
              fn(input),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Tool call timed out')), timeoutMs),
              ),
            ])
          : fn(input);

        try {
          const output = await execute;
          const durationMs = performance.now() - start;
          const outputPreview = makePreview(output);
          const outputSizeBytes = estimateBytes(output);

          tracer.setAttributes(ctx.spanId, {
            'tool.output': output,
            'tool.duration_ms': Math.round(durationMs * 100) / 100,
            'tool.status': 'success',
            ...(outputPreview !== undefined && { 'tool.output_preview': outputPreview }),
            ...(outputSizeBytes > 0 && { 'tool.output_size_bytes': outputSizeBytes }),
          });
          return output;
        } catch (err) {
          const durationMs = performance.now() - start;
          const isTimeout = err instanceof Error && err.message === 'Tool call timed out';
          tracer.setAttributes(ctx.spanId, {
            'tool.error': err instanceof Error ? err.message : String(err),
            'tool.duration_ms': Math.round(durationMs * 100) / 100,
            'tool.status': isTimeout ? 'timeout' : 'error',
          });
          throw err;
        }
      },
      attrs,
    );
  };
}
