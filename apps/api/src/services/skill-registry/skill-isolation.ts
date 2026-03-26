/**
 * Skill Isolation — wraps lifecycle hook execution with timeouts
 * and error boundaries so a broken plugin doesn't crash the agent.
 */

import type { SkillLifecycleHooks, SkillContext } from '@openspace/shared/src/types/skill.js';

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
