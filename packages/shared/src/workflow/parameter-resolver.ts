/**
 * Parameter Resolver — resolves ParameterMapping entries against
 * an ExecutionContext to produce concrete tool parameters.
 *
 * Pure functions with no side effects.
 */

import type { ExecutionContext, ParameterMapping } from '../types/dag-workflow.js';

/**
 * Resolve tool parameters from static values or dynamic mappings.
 *
 * If `params` is a plain object, it's returned as-is (static params).
 * If `params` is a ParameterMapping array, each mapping is resolved
 * against the ExecutionContext.
 */
export function resolveToolParams(
  params: Record<string, unknown> | ParameterMapping[] | undefined,
  ctx: ExecutionContext,
): Record<string, unknown> {
  if (!params) return {};
  if (!Array.isArray(params)) return params;

  const resolved: Record<string, unknown> = {};
  for (const mapping of params) {
    resolved[mapping.param] = resolvePath(mapping.from, ctx);
  }
  return resolved;
}

/**
 * Resolve a dot-path expression against an ExecutionContext.
 *
 * The path root is `ctx`, so:
 *   "ctx.vars.repoUrl"                       → ctx.vars.repoUrl
 *   "ctx.nodeOutputs['fetch-repo'].data.sha" → ctx.nodeOutputs['fetch-repo'].data.sha
 *   "ctx.secrets.GITHUB_TOKEN"               → ctx.secrets.GITHUB_TOKEN
 */
export function resolvePath(path: string, ctx: ExecutionContext): unknown {
  const root: Record<string, unknown> = { ctx };
  const parts = tokenizePath(path);
  let current: unknown = root;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Tokenize a dot-path, handling bracket notation.
 * e.g. "ctx.nodeOutputs['fetch-repo'].data" → ["ctx", "nodeOutputs", "fetch-repo", "data"]
 */
function tokenizePath(path: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < path.length) {
    if (path[i] === '[') {
      const quote = path[i + 1];
      if (quote === "'" || quote === '"') {
        const closeQuote = path.indexOf(quote + ']', i + 2);
        if (closeQuote === -1) throw new Error(`Unclosed bracket in path: ${path}`);
        tokens.push(path.slice(i + 2, closeQuote));
        i = closeQuote + 2;
        if (path[i] === '.') i++;
      } else {
        throw new Error(`Invalid bracket notation in path: ${path}`);
      }
    } else if (path[i] === '.') {
      i++;
    } else {
      let end = i;
      while (end < path.length && path[end] !== '.' && path[end] !== '[') end++;
      tokens.push(path.slice(i, end));
      i = end;
    }
  }

  return tokens;
}
