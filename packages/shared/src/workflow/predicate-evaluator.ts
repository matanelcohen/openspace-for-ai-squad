/**
 * Predicate Evaluator — evaluates ConditionalPredicate trees against
 * node output and ExecutionContext.
 *
 * Pure functions with no side effects. Fully unit-testable.
 */

import type {
  ComparisonPredicate,
  ConditionalPredicate,
  ExecutionContext,
  ExpressionPredicate,
} from '../types/dag-workflow.js';

// ── Public API ──────────────────────────────────────────────────

/**
 * Evaluate a conditional predicate against a node's output and context.
 * Returns true if the predicate is satisfied.
 */
export function evaluatePredicate(
  predicate: ConditionalPredicate,
  nodeOutput: unknown,
  ctx: ExecutionContext,
): boolean {
  switch (predicate.type) {
    case 'comparison':
      return evaluateComparison(predicate, nodeOutput, ctx);
    case 'and':
      return predicate.operands.every((op) => evaluatePredicate(op, nodeOutput, ctx));
    case 'or':
      return predicate.operands.some((op) => evaluatePredicate(op, nodeOutput, ctx));
    case 'not':
      if (predicate.operands.length === 0) return true;
      return !evaluatePredicate(predicate.operands[0]!, nodeOutput, ctx);
    case 'expression':
      return evaluateSandboxedExpression(predicate, nodeOutput, ctx);
    default:
      throw new PredicateEvaluationError(
        `Unknown predicate type: ${(predicate as { type: string }).type}`,
      );
  }
}

// ── Comparison ──────────────────────────────────────────────────

function evaluateComparison(
  predicate: ComparisonPredicate,
  nodeOutput: unknown,
  ctx: ExecutionContext,
): boolean {
  const actual = resolveField(predicate.field, nodeOutput, ctx);
  return compareValues(actual, predicate.operator, predicate.value);
}

/**
 * Resolve a dot-path field reference against the node output and context.
 *
 * Supported prefixes:
 *   "output.X"  → resolves X from nodeOutput
 *   "ctx.X"     → resolves X from ExecutionContext
 *
 * Bracket notation is supported: "ctx.nodeOutputs['fetch-repo'].data"
 */
export function resolveField(
  path: string,
  nodeOutput: unknown,
  ctx: ExecutionContext,
): unknown {
  const root: Record<string, unknown> = {
    output: nodeOutput,
    ctx,
  };

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
      // Bracket notation: ['key'] or ["key"]
      const quote = path[i + 1];
      if (quote === "'" || quote === '"') {
        const closeQuote = path.indexOf(quote + ']', i + 2);
        if (closeQuote === -1) throw new PredicateEvaluationError(`Unclosed bracket in path: ${path}`);
        tokens.push(path.slice(i + 2, closeQuote));
        i = closeQuote + 2; // skip past ']'
        if (path[i] === '.') i++; // skip trailing dot
      } else {
        throw new PredicateEvaluationError(`Invalid bracket notation in path: ${path}`);
      }
    } else if (path[i] === '.') {
      i++; // skip leading dot
    } else {
      // Regular dot-separated key
      let end = i;
      while (end < path.length && path[end] !== '.' && path[end] !== '[') end++;
      tokens.push(path.slice(i, end));
      i = end;
    }
  }

  return tokens;
}

/**
 * Compare two values using the given operator.
 */
export function compareValues(
  actual: unknown,
  operator: ComparisonPredicate['operator'],
  expected: unknown,
): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected;
    case 'neq':
      return actual !== expected;
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'gte':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected;
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'lte':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected;
    case 'in':
      return Array.isArray(expected) && expected.includes(actual);
    case 'not_in':
      return Array.isArray(expected) && !expected.includes(actual);
    case 'matches':
      if (typeof actual !== 'string' || typeof expected !== 'string') return false;
      try {
        return new RegExp(expected).test(actual);
      } catch {
        return false;
      }
    default:
      throw new PredicateEvaluationError(`Unknown comparison operator: ${String(operator)}`);
  }
}

// ── Expression Evaluation ───────────────────────────────────────

/**
 * Evaluate a sandboxed expression predicate.
 * Uses a restricted allowlist of operations — NOT `eval`.
 *
 * For v1, expression predicates support only simple comparisons
 * chained with && and ||. Complex expressions should be decomposed
 * into ComparisonPredicate / LogicalPredicate trees.
 */
function evaluateSandboxedExpression(
  predicate: ExpressionPredicate,
  _nodeOutput: unknown,
  _ctx: ExecutionContext,
): boolean {
  // For safety, expression evaluation is deliberately limited in v1.
  // Complex expressions should use the structured predicate tree.
  throw new PredicateEvaluationError(
    `Expression predicates are not yet supported in v1. ` +
    `Decompose "${predicate.expr}" into comparison/logical predicates.`,
  );
}

// ── Errors ──────────────────────────────────────────────────────

export class PredicateEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PredicateEvaluationError';
  }
}
