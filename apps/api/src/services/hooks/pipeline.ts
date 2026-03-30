/**
 * Governance Hook Pipeline — pre-execution checks for agent tool calls.
 *
 * Validates that agent actions comply with configured safety rules
 * before allowing them to proceed.
 */

import type { HooksDefinition } from '@matanelcohen/openspace-shared';

// ── Types ────────────────────────────────────────────────────────

export interface HookContext {
  agentId: string;
  taskId?: string;
  tool: string;
  params: Record<string, unknown>;
}

export type HookAction = 'allow' | 'block' | 'modify';

export interface HookResult {
  action: HookAction;
  reason?: string;
  modifiedParams?: Record<string, unknown>;
}

export type PreHook = (context: HookContext) => Promise<HookResult>;

// ── Pipeline ─────────────────────────────────────────────────────

export class HookPipeline {
  private preHooks: PreHook[] = [];

  /** Register a pre-execution hook. */
  addPreHook(hook: PreHook): void {
    this.preHooks.push(hook);
  }

  /** Run all hooks against the given context. First block wins. */
  async execute(context: HookContext): Promise<{ allowed: boolean; reason?: string }> {
    for (const hook of this.preHooks) {
      try {
        const result = await hook(context);
        if (result.action === 'block') {
          return { allowed: false, reason: result.reason };
        }
      } catch (err) {
        // Hook errors should not block execution — log and continue
        console.warn('[Hooks] Hook threw error, skipping:', err);
      }
    }
    return { allowed: true };
  }
}

// ── Glob matcher ─────────────────────────────────────────────────

/** Simple glob match supporting * and ** patterns. */
function simpleGlobMatch(pattern: string, filePath: string): boolean {
  const regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '{{GLOBSTAR}}')
    .replace(/\*/g, '[^/]*')
    .replace(/\{\{GLOBSTAR\}\}/g, '.*');
  return new RegExp(`^${regexStr}`).test(filePath);
}

// ── Built-in Hooks ───────────────────────────────────────────────

/**
 * FileGuard — blocks file writes outside of allowed paths.
 */
export function createFileGuardHook(allowedPaths: string[]): PreHook {
  return async (ctx) => {
    const writingTools = ['edit', 'create', 'write', 'file_write'];
    if (!writingTools.includes(ctx.tool)) return { action: 'allow' };

    const filePath = (ctx.params.path ?? ctx.params.file ?? '') as string;
    if (!filePath) return { action: 'allow' };

    const isAllowed = allowedPaths.some((pattern) => simpleGlobMatch(pattern, filePath));
    if (!isAllowed) {
      return {
        action: 'block',
        reason: `FileGuard: write to "${filePath}" blocked — not in allowed paths`,
      };
    }
    return { action: 'allow' };
  };
}

/**
 * ShellRestriction — blocks dangerous shell commands.
 */
export function createShellRestrictionHook(blockedCommands: string[]): PreHook {
  return async (ctx) => {
    const shellTools = ['bash', 'shell', 'exec', 'terminal', 'command'];
    if (!shellTools.includes(ctx.tool)) return { action: 'allow' };

    const command = (ctx.params.command ?? ctx.params.cmd ?? '') as string;
    if (!command) return { action: 'allow' };

    const lower = command.toLowerCase();
    for (const blocked of blockedCommands) {
      if (lower.includes(blocked.toLowerCase())) {
        return {
          action: 'block',
          reason: `ShellRestriction: command contains blocked pattern "${blocked}"`,
        };
      }
    }
    return { action: 'allow' };
  };
}

/**
 * RateLimit — limits tool calls per agent per minute.
 */
export function createRateLimitHook(maxPerMinute: number): PreHook {
  const callLog = new Map<string, number[]>();

  return async (ctx) => {
    const now = Date.now();
    const key = ctx.agentId;
    const timestamps = callLog.get(key) ?? [];

    // Prune entries older than 60 seconds
    const recent = timestamps.filter((t) => now - t < 60_000);

    if (recent.length >= maxPerMinute) {
      return {
        action: 'block',
        reason: `RateLimit: agent "${ctx.agentId}" exceeded ${maxPerMinute} calls/minute`,
      };
    }

    recent.push(now);
    callLog.set(key, recent);
    return { action: 'allow' };
  };
}

/**
 * Build a fully-configured HookPipeline from a HooksDefinition.
 */
export function buildHookPipeline(config: HooksDefinition): HookPipeline {
  const pipeline = new HookPipeline();

  if (config.allowedWritePaths?.length) {
    pipeline.addPreHook(createFileGuardHook(config.allowedWritePaths));
  }

  if (config.blockedCommands?.length) {
    pipeline.addPreHook(createShellRestrictionHook(config.blockedCommands));
  }

  if (config.maxAskUser) {
    pipeline.addPreHook(createRateLimitHook(config.maxAskUser * 10));
  }

  return pipeline;
}
