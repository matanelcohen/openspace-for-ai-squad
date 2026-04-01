import { calculateCost } from './cost-calculator.js';
import type { Tracer } from './tracer.js';
import type { LLMCallOptions, LLMSpanAttributes, ModelPriceTable } from './types.js';

/**
 * Wrap an LLM call function with automatic tracing instrumentation.
 *
 * Captures:
 * - Model name and provider
 * - Token usage (prompt, completion, total)
 * - Cost in USD (if a price table is provided)
 * - Streaming latency (time to first token event)
 * - Total duration
 *
 * @example
 * ```ts
 * const traced = instrumentLLMCall(tracer, {
 *   model: 'gpt-4',
 *   provider: 'openai',
 *   fn: async (prompt) => openai.complete(prompt),
 *   extractUsage: (res) => ({
 *     promptTokens: res.usage.prompt_tokens,
 *     completionTokens: res.usage.completion_tokens,
 *   }),
 * });
 * const response = await traced('Hello, world!');
 * ```
 */
export function instrumentLLMCall<TInput, TOutput>(
  tracer: Tracer,
  options: LLMCallOptions<TInput, TOutput>,
  priceTable?: ModelPriceTable,
): (input: TInput) => Promise<TOutput> {
  const { model, provider, fn, extractUsage, streaming } = options;

  return async (input: TInput): Promise<TOutput> => {
    const attrs: Record<string, unknown> = {
      'llm.model': model,
      ...(provider && { 'llm.provider': provider }),
      ...(streaming !== undefined && { 'llm.streaming': streaming }),
      'llm.input': input,
      ...(Array.isArray(input) && { 'llm.messages_count': input.length }),
    } satisfies Partial<Record<keyof LLMSpanAttributes, unknown>>;

    return tracer.withSpan(
      `llm:${model}`,
      'llm',
      async (ctx) => {
        const start = performance.now();

        if (streaming) {
          tracer.recordEvent(ctx.spanId, 'llm.stream.start');
        }

        const output = await fn(input);
        const totalDurationMs = performance.now() - start;

        const usage = extractUsage?.(output);
        const promptTokens = usage?.promptTokens;
        const completionTokens = usage?.completionTokens;
        const totalTokens =
          promptTokens !== undefined || completionTokens !== undefined
            ? (promptTokens ?? 0) + (completionTokens ?? 0)
            : undefined;

        const costUsd =
          priceTable && promptTokens !== undefined && completionTokens !== undefined
            ? calculateCost(model, promptTokens, completionTokens, priceTable)
            : undefined;

        const llmAttrs: Record<string, unknown> = {
          ...(promptTokens !== undefined && { 'llm.prompt_tokens': promptTokens }),
          ...(completionTokens !== undefined && {
            'llm.completion_tokens': completionTokens,
          }),
          ...(totalTokens !== undefined && { 'llm.total_tokens': totalTokens }),
          ...(costUsd !== undefined && { 'llm.cost_usd': costUsd }),
          'llm.total_duration_ms': Math.round(totalDurationMs * 100) / 100,
          'llm.output': output,
        };

        tracer.setAttributes(ctx.spanId, llmAttrs);
        return output;
      },
      attrs,
    );
  };
}
