import { calculateCost } from './cost-calculator.js';
import type { Tracer } from './tracer.js';
import type { LLMCallOptions, LLMSpanAttributes, ModelPriceTable } from './types.js';

// ── Helpers ────────────────────────────────────────────────────────

/** Produce a truncated human-readable preview of data (max `maxLen` chars). */
function makePreview(data: unknown, maxLen = 200): string | undefined {
  if (data == null) return undefined;
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

/**
 * Wrap an LLM call function with automatic tracing instrumentation.
 *
 * Captures:
 * - Model name and provider
 * - Token usage (prompt, completion, total)
 * - Cost in USD (if a price table is provided)
 * - Streaming latency (time to first token event)
 * - Total duration
 * - Prompt/response previews
 * - Stop reason, temperature, max_tokens
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
  const {
    model,
    provider,
    fn,
    extractUsage,
    streaming,
    extractStopReason,
    extractResponse,
    temperature,
    maxTokens,
    systemPrompt,
    onFirstToken,
  } = options;

  return async (input: TInput): Promise<TOutput> => {
    // Build initial attributes
    const userPromptPreview = makePreview(input);
    const systemPromptPreview = makePreview(systemPrompt);

    const attrs: Record<string, unknown> = {
      'llm.model': model,
      ...(provider && { 'llm.provider': provider }),
      ...(streaming !== undefined && { 'llm.streaming': streaming }),
      ...(temperature !== undefined && { 'llm.temperature': temperature }),
      ...(maxTokens !== undefined && { 'llm.max_tokens': maxTokens }),
      ...(userPromptPreview !== undefined && { 'llm.user_prompt_preview': userPromptPreview }),
      ...(systemPromptPreview !== undefined && {
        'llm.system_prompt_preview': systemPromptPreview,
      }),
    } satisfies Partial<Record<keyof LLMSpanAttributes, unknown>>;

    return tracer.withSpan(
      `llm:${model}`,
      'llm',
      async (ctx) => {
        const start = performance.now();
        let firstTokenMs: number | undefined;

        if (streaming) {
          tracer.recordEvent(ctx.spanId, 'llm.stream.start');

          // If caller provides an onFirstToken hook, use it to measure TTFT
          if (onFirstToken) {
            onFirstToken(() => {
              firstTokenMs = performance.now() - start;
              tracer.setAttributes(ctx.spanId, {
                'llm.time_to_first_token_ms': Math.round(firstTokenMs * 100) / 100,
              });
              tracer.recordEvent(ctx.spanId, 'llm.stream.first_token');
            });
          }
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

        // Extract optional enrichment from response
        const stopReason = extractStopReason?.(output);
        const responseText = extractResponse?.(output);
        const responsePreview = makePreview(responseText);

        const llmAttrs: Record<string, unknown> = {
          ...(promptTokens !== undefined && { 'llm.prompt_tokens': promptTokens }),
          ...(completionTokens !== undefined && {
            'llm.completion_tokens': completionTokens,
          }),
          ...(totalTokens !== undefined && { 'llm.total_tokens': totalTokens }),
          ...(costUsd !== undefined && { 'llm.cost_usd': costUsd }),
          'llm.total_duration_ms': Math.round(totalDurationMs * 100) / 100,
          ...(stopReason !== undefined && { 'llm.stop_reason': stopReason }),
          ...(responsePreview !== undefined && { 'llm.response_preview': responsePreview }),
        };

        tracer.setAttributes(ctx.spanId, llmAttrs);
        return output;
      },
      attrs,
    );
  };
}
