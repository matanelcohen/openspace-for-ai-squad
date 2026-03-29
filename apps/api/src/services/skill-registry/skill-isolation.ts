/**
 * Skill Isolation — wraps lifecycle hook execution with timeouts,
 * error boundaries, and configurable retry logic so a broken plugin
 * doesn't crash the agent.
 */

import type {
  BackoffStrategy,
  SkillContext,
  SkillLifecycleHooks,
  SkillRetryPolicy,
} from '@openspace/shared';
import { DEFAULT_RETRY_POLICY } from '@openspace/shared';

const DEFAULT_HOOK_TIMEOUT_MS = 30_000; // 30 seconds per architecture spec

export interface HookExecutionResult<T = void> {
  success: boolean;
  result?: T;
  error?: Error;
  durationMs: number;
}

/**
 * Execute a lifecycle hook with timeout and error isolation.
 * Returns a result object instead of throwing — callers decide how to handle.
 */
export async function executeHook<T>(
  hookName: string,
  fn: () => Promise<T>,
  timeoutMs: number = DEFAULT_HOOK_TIMEOUT_MS,
): Promise<HookExecutionResult<T>> {
  const start = Date.now();

  try {
    const result = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Hook "${hookName}" timed out after ${timeoutMs}ms`)),
          timeoutMs,
        ),
      ),
    ]);
    return { success: true, result, durationMs: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Safely call onLoad if present.
 */
export async function safeOnLoad(
  hooks: SkillLifecycleHooks | null,
  ctx: SkillContext,
): Promise<HookExecutionResult> {
  if (!hooks?.onLoad) return { success: true, durationMs: 0 };
  return executeHook('onLoad', () => hooks.onLoad!(ctx));
}

/**
 * Safely call onActivate if present.
 */
export async function safeOnActivate(
  hooks: SkillLifecycleHooks | null,
  ctx: SkillContext,
): Promise<HookExecutionResult<Record<string, unknown> | void>> {
  if (!hooks?.onActivate) return { success: true, durationMs: 0 };
  return executeHook('onActivate', () => hooks.onActivate!(ctx));
}

/**
 * Safely call onDeactivate if present.
 */
export async function safeOnDeactivate(
  hooks: SkillLifecycleHooks | null,
  ctx: SkillContext,
): Promise<HookExecutionResult> {
  if (!hooks?.onDeactivate) return { success: true, durationMs: 0 };
  return executeHook('onDeactivate', () => hooks.onDeactivate!(ctx));
}

/**
 * Safely call onUnload if present.
 */
export async function safeOnUnload(
  hooks: SkillLifecycleHooks | null,
): Promise<HookExecutionResult> {
  if (!hooks?.onUnload) return { success: true, durationMs: 0 };
  return executeHook('onUnload', () => hooks.onUnload!());
}

/**
 * Safely import a skill entry point module.
 * Returns the lifecycle hooks or an error.
 */
export async function safeImportEntryPoint(
  entryPointPath: string,
): Promise<HookExecutionResult<SkillLifecycleHooks>> {
  const start = Date.now();
  try {
    const mod = await import(entryPointPath);
    const hooks: SkillLifecycleHooks = mod.default ?? mod;
    return { success: true, result: hooks, durationMs: Date.now() - start };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
      durationMs: Date.now() - start,
    };
  }
}

// ── Retry & Backoff ──────────────────────────────────────────────

/**
 * Calculate the delay before the next retry attempt.
 *
 * @param attempt  Zero-based attempt index (0 = first retry).
 * @param strategy Backoff strategy.
 * @param baseMs   Base delay in milliseconds.
 * @param maxMs    Maximum delay cap.
 */
export function calculateBackoffDelay(
  attempt: number,
  strategy: BackoffStrategy = 'exponential',
  baseMs: number = 1000,
  maxMs: number = 30_000,
): number {
  let delay: number;

  switch (strategy) {
    case 'fixed':
      delay = baseMs;
      break;
    case 'linear':
      delay = baseMs * (attempt + 1);
      break;
    case 'exponential':
      delay = baseMs * Math.pow(2, attempt);
      break;
    default:
      delay = baseMs * Math.pow(2, attempt);
  }

  return Math.min(delay, maxMs);
}

/** Result of a retried hook execution — extends HookExecutionResult with attempt metadata. */
export interface RetryHookExecutionResult<T = void> extends HookExecutionResult<T> {
  /** Total number of attempts made (1 = no retries, 2+ = retried). */
  attempts: number;
  /** Errors from each failed attempt (empty if first attempt succeeded). */
  attemptErrors: Error[];
}

/**
 * Execute a lifecycle hook with automatic retry and backoff.
 *
 * Attempts the hook up to `maxRetries + 1` times. Between retries,
 * waits according to the configured backoff strategy. The optional
 * `onRetry` callback fires before each retry delay so callers can
 * emit events or update state.
 */
export async function executeHookWithRetry<T>(
  hookName: string,
  fn: () => Promise<T>,
  policy: SkillRetryPolicy = DEFAULT_RETRY_POLICY,
  timeoutMs: number = DEFAULT_HOOK_TIMEOUT_MS,
  onRetry?: (attempt: number, error: Error) => void,
): Promise<RetryHookExecutionResult<T>> {
  const attemptErrors: Error[] = [];
  let totalDuration = 0;

  for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
    const result = await executeHook<T>(hookName, fn, timeoutMs);
    totalDuration += result.durationMs;

    if (result.success) {
      return {
        ...result,
        durationMs: totalDuration,
        attempts: attempt + 1,
        attemptErrors,
      };
    }

    attemptErrors.push(result.error ?? new Error('Unknown error'));

    // Don't delay after the final attempt
    if (attempt < policy.maxRetries) {
      onRetry?.(attempt, result.error ?? new Error('Unknown error'));

      const delay = calculateBackoffDelay(
        attempt,
        policy.backoffStrategy,
        policy.backoffBaseMs,
        policy.backoffMaxMs,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All attempts exhausted
  const lastError = attemptErrors[attemptErrors.length - 1] ?? new Error('All retries exhausted');
  return {
    success: false,
    error: lastError,
    durationMs: totalDuration,
    attempts: policy.maxRetries + 1,
    attemptErrors,
  };
}
