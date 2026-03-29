import { describe, expect, it } from 'vitest';

import type { ConditionalPredicate, ExecutionContext } from '../types/dag-workflow.js';
import {
  compareValues,
  evaluatePredicate,
  PredicateEvaluationError,
  resolveField,
} from '../workflow/predicate-evaluator.js';

// ── Test Helpers ────────────────────────────────────────────────

function makeCtx(overrides?: Partial<ExecutionContext>): ExecutionContext {
  return {
    executionId: 'exec-1',
    workflowId: 'wf-1',
    workflowVersion: '1.0.0',
    vars: { env: 'prod', threshold: 0.8 },
    nodeOutputs: {},
    secrets: {},
    toolRegistry: { invoke: async () => ({ success: true, durationMs: 0 }), discover: () => [] },
    startedAt: '2026-01-01T00:00:00Z',
    traceId: 'trace-1',
    ...overrides,
  };
}

// ── compareValues Tests ─────────────────────────────────────────

describe('compareValues', () => {
  it('eq: true when values are equal', () => {
    expect(compareValues('hello', 'eq', 'hello')).toBe(true);
    expect(compareValues(42, 'eq', 42)).toBe(true);
  });

  it('eq: false when values differ', () => {
    expect(compareValues('hello', 'eq', 'world')).toBe(false);
  });

  it('neq: true when values differ', () => {
    expect(compareValues('hello', 'neq', 'world')).toBe(true);
  });

  it('gt: numeric comparison', () => {
    expect(compareValues(10, 'gt', 5)).toBe(true);
    expect(compareValues(5, 'gt', 10)).toBe(false);
    expect(compareValues(5, 'gt', 5)).toBe(false);
  });

  it('gte: numeric comparison', () => {
    expect(compareValues(10, 'gte', 5)).toBe(true);
    expect(compareValues(5, 'gte', 5)).toBe(true);
    expect(compareValues(4, 'gte', 5)).toBe(false);
  });

  it('lt: numeric comparison', () => {
    expect(compareValues(3, 'lt', 5)).toBe(true);
    expect(compareValues(5, 'lt', 5)).toBe(false);
  });

  it('lte: numeric comparison', () => {
    expect(compareValues(3, 'lte', 5)).toBe(true);
    expect(compareValues(5, 'lte', 5)).toBe(true);
    expect(compareValues(6, 'lte', 5)).toBe(false);
  });

  it('in: checks array membership', () => {
    expect(compareValues('a', 'in', ['a', 'b', 'c'])).toBe(true);
    expect(compareValues('d', 'in', ['a', 'b', 'c'])).toBe(false);
  });

  it('not_in: checks array non-membership', () => {
    expect(compareValues('d', 'not_in', ['a', 'b', 'c'])).toBe(true);
    expect(compareValues('a', 'not_in', ['a', 'b', 'c'])).toBe(false);
  });

  it('matches: regex matching', () => {
    expect(compareValues('hello-world', 'matches', '^hello')).toBe(true);
    expect(compareValues('goodbye', 'matches', '^hello')).toBe(false);
  });

  it('matches: returns false for non-string inputs', () => {
    expect(compareValues(42, 'matches', '^42')).toBe(false);
  });

  it('gt/lt return false for non-numeric inputs', () => {
    expect(compareValues('a', 'gt', 'b')).toBe(false);
    expect(compareValues('a', 'lt', 'b')).toBe(false);
  });
});

// ── resolveField Tests ──────────────────────────────────────────

describe('resolveField', () => {
  it('resolves output fields', () => {
    const result = resolveField('output.status', { status: 'ok', data: 42 }, makeCtx());
    expect(result).toBe('ok');
  });

  it('resolves nested output fields', () => {
    const result = resolveField('output.data.value', { data: { value: 99 } }, makeCtx());
    expect(result).toBe(99);
  });

  it('resolves ctx.vars fields', () => {
    const result = resolveField('ctx.vars.env', {}, makeCtx());
    expect(result).toBe('prod');
  });

  it('returns undefined for missing paths', () => {
    const result = resolveField('output.nonexistent.deep', {}, makeCtx());
    expect(result).toBeUndefined();
  });

  it('handles bracket notation', () => {
    const ctx = makeCtx({
      nodeOutputs: {
        'fetch-repo': { data: { sha: 'abc123' }, completedAt: '', durationMs: 0 },
      },
    });
    const result = resolveField("ctx.nodeOutputs['fetch-repo'].data.sha", {}, ctx);
    expect(result).toBe('abc123');
  });
});

// ── evaluatePredicate Tests ─────────────────────────────────────

describe('evaluatePredicate', () => {
  it('evaluates a simple comparison predicate', () => {
    const pred: ConditionalPredicate = {
      type: 'comparison',
      field: 'output.status',
      operator: 'eq',
      value: 'ok',
    };
    expect(evaluatePredicate(pred, { status: 'ok' }, makeCtx())).toBe(true);
    expect(evaluatePredicate(pred, { status: 'error' }, makeCtx())).toBe(false);
  });

  it('evaluates AND logical predicate', () => {
    const pred: ConditionalPredicate = {
      type: 'and',
      operands: [
        { type: 'comparison', field: 'output.a', operator: 'eq', value: 1 },
        { type: 'comparison', field: 'output.b', operator: 'eq', value: 2 },
      ],
    };
    expect(evaluatePredicate(pred, { a: 1, b: 2 }, makeCtx())).toBe(true);
    expect(evaluatePredicate(pred, { a: 1, b: 3 }, makeCtx())).toBe(false);
  });

  it('evaluates OR logical predicate', () => {
    const pred: ConditionalPredicate = {
      type: 'or',
      operands: [
        { type: 'comparison', field: 'output.x', operator: 'eq', value: 'a' },
        { type: 'comparison', field: 'output.x', operator: 'eq', value: 'b' },
      ],
    };
    expect(evaluatePredicate(pred, { x: 'a' }, makeCtx())).toBe(true);
    expect(evaluatePredicate(pred, { x: 'b' }, makeCtx())).toBe(true);
    expect(evaluatePredicate(pred, { x: 'c' }, makeCtx())).toBe(false);
  });

  it('evaluates NOT logical predicate', () => {
    const pred: ConditionalPredicate = {
      type: 'not',
      operands: [{ type: 'comparison', field: 'output.flag', operator: 'eq', value: true }],
    };
    expect(evaluatePredicate(pred, { flag: false }, makeCtx())).toBe(true);
    expect(evaluatePredicate(pred, { flag: true }, makeCtx())).toBe(false);
  });

  it('NOT with empty operands returns true', () => {
    const pred: ConditionalPredicate = { type: 'not', operands: [] };
    expect(evaluatePredicate(pred, {}, makeCtx())).toBe(true);
  });

  it('nested predicates work', () => {
    const pred: ConditionalPredicate = {
      type: 'and',
      operands: [
        { type: 'comparison', field: 'output.score', operator: 'gt', value: 0.5 },
        {
          type: 'or',
          operands: [
            { type: 'comparison', field: 'ctx.vars.env', operator: 'eq', value: 'prod' },
            { type: 'comparison', field: 'ctx.vars.env', operator: 'eq', value: 'staging' },
          ],
        },
      ],
    };
    expect(evaluatePredicate(pred, { score: 0.9 }, makeCtx())).toBe(true);
    expect(evaluatePredicate(pred, { score: 0.3 }, makeCtx())).toBe(false);
    expect(evaluatePredicate(pred, { score: 0.9 }, makeCtx({ vars: { env: 'dev' } }))).toBe(false);
  });

  it('expression predicates throw PredicateEvaluationError (v1)', () => {
    const pred: ConditionalPredicate = {
      type: 'expression',
      expr: 'output.score > 0.8',
    };
    expect(() => evaluatePredicate(pred, { score: 0.9 }, makeCtx())).toThrow(PredicateEvaluationError);
  });

  it('unknown predicate type throws PredicateEvaluationError', () => {
    const pred = { type: 'unknown' } as unknown as ConditionalPredicate;
    expect(() => evaluatePredicate(pred, {}, makeCtx())).toThrow(PredicateEvaluationError);
  });
});
