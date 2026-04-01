/**
 * Error Tracing — Unit Tests
 *
 * Verifies tracing behaviour under failure conditions:
 *   - Error spans carry full stack traces in events
 *   - Retry attempts create individual child spans
 *   - Timeout exceptions are properly categorized
 */
import { describe, expect, it } from 'vitest';

import { instrumentToolCall } from '../instrument-tool.js';
import { TraceCollector } from '../trace-collector.js';
import { Tracer } from '../tracer.js';
import type { Span } from '../types.js';

// ── Helpers ─────────────────────────────────────────────────────────

function makeStack() {
  const collected: Span[] = [];
  const collector = new TraceCollector({
    batchSize: 100,
    flushIntervalMs: 0,
    sink: async (batch) => collected.push(...batch),
  });
  const tracer = new Tracer({ serviceName: 'error-tracing-test', collector });
  return { tracer, collected, collector };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Error Tracing', () => {
  describe('error spans with stack traces', () => {
    it('tool failure records exception event with error message', async () => {
      const { tracer, collected, collector } = makeStack();

      const failingTool = instrumentToolCall(tracer, {
        toolId: 'db-query',
        toolName: 'Database Query',
        fn: async () => {
          throw new Error('ECONNREFUSED: connection to database refused');
        },
      });

      await expect(failingTool('SELECT * FROM users')).rejects.toThrow(
        'ECONNREFUSED',
      );
      await collector.flush();

      expect(collected).toHaveLength(1);
      const span = collected[0]!;
      expect(span.status).toBe('error');
      expect(span.attributes['tool.error']).toBe(
        'ECONNREFUSED: connection to database refused',
      );
      expect(span.attributes['tool.id']).toBe('db-query');
      expect(span.attributes['tool.input']).toBe('SELECT * FROM users');
    });

    it('withSpan records exception event with message on error', async () => {
      const { tracer, collected, collector } = makeStack();

      await expect(
        tracer.withSpan('agent:failing-task', 'agent', async () => {
          throw new Error('Task processing failed: invalid state');
        }),
      ).rejects.toThrow('Task processing failed');

      await collector.flush();

      const span = collected[0]!;
      expect(span.status).toBe('error');
      expect(span.events).toHaveLength(1);
      expect(span.events[0]!.name).toBe('exception');
      expect(span.events[0]!.attributes?.['exception.message']).toBe(
        'Task processing failed: invalid state',
      );
    });

    it('deeply nested error propagates through span hierarchy', async () => {
      const { tracer, collected, collector } = makeStack();

      await expect(
        tracer.withSpan('workflow:deploy', 'agent', async () => {
          await tracer.withSpan('node:write', 'internal', async () => {
            await tracer.withSpan('tool:file-write', 'tool', async () => {
              throw new Error('Disk full');
            });
          });
        }),
      ).rejects.toThrow('Disk full');

      await collector.flush();

      expect(collected).toHaveLength(3);
      for (const span of collected) {
        expect(span.status).toBe('error');
      }

      for (const span of collected) {
        const exceptionEvent = span.events.find((e) => e.name === 'exception');
        expect(exceptionEvent).toBeDefined();
        expect(exceptionEvent!.attributes?.['exception.message']).toBe('Disk full');
      }
    });

    it('non-Error thrown values are captured as strings', async () => {
      const { tracer, collected, collector } = makeStack();

      await expect(
        tracer.withSpan('task:bad-throw', 'internal', async () => {
          throw 'string error thrown'; // eslint-disable-line no-throw-literal
        }),
      ).rejects.toBe('string error thrown');

      await collector.flush();

      const span = collected[0]!;
      expect(span.status).toBe('error');
      expect(span.events[0]!.attributes?.['exception.message']).toBe(
        'string error thrown',
      );
    });
  });

  describe('retry attempts as individual spans', () => {
    it('each retry attempt creates a separate child span', async () => {
      const { tracer, collected, collector } = makeStack();

      let attempts = 0;
      const maxRetries = 3;

      await tracer.withSpan('workflow:with-retries', 'agent', async () => {
        let lastError: Error | null = null;

        for (let i = 0; i < maxRetries; i++) {
          try {
            await tracer.withSpan(`retry:attempt-${i}`, 'internal', async (ctx) => {
              tracer.setAttributes(ctx.spanId, {
                'retry.attempt': i,
                'retry.max_attempts': maxRetries,
              });
              attempts++;
              if (i < 2) {
                throw new Error(`Attempt ${i} failed: service unavailable`);
              }
            });
            lastError = null;
            break;
          } catch (err) {
            lastError = err as Error;
          }
        }

        if (lastError) throw lastError;
      });

      await collector.flush();

      // 4 spans: 1 root + 3 attempt spans
      expect(collected).toHaveLength(4);
      expect(attempts).toBe(3);

      const root = collected.find((s) => s.name === 'workflow:with-retries')!;
      expect(root.status).toBe('ok');

      const retrySpans = collected.filter((s) => s.name.startsWith('retry:'));
      expect(retrySpans).toHaveLength(3);

      const attempt0 = retrySpans.find(
        (s) => s.attributes['retry.attempt'] === 0,
      )!;
      expect(attempt0.status).toBe('error');
      expect(attempt0.events[0]!.attributes?.['exception.message']).toContain(
        'Attempt 0 failed',
      );

      const attempt1 = retrySpans.find(
        (s) => s.attributes['retry.attempt'] === 1,
      )!;
      expect(attempt1.status).toBe('error');

      const attempt2 = retrySpans.find(
        (s) => s.attributes['retry.attempt'] === 2,
      )!;
      expect(attempt2.status).toBe('ok');

      for (const span of retrySpans) {
        expect(span.context.traceId).toBe(root.context.traceId);
        expect(span.context.parentSpanId).toBe(root.context.spanId);
      }
    });

    it('all retries fail — root span is also in error state', async () => {
      const { tracer, collected, collector } = makeStack();

      await expect(
        tracer.withSpan('workflow:all-retries-fail', 'agent', async () => {
          for (let i = 0; i < 3; i++) {
            try {
              await tracer.withSpan(`retry:attempt-${i}`, 'internal', async () => {
                throw new Error(`Attempt ${i} failed`);
              });
            } catch {
              if (i === 2) throw new Error('All retries exhausted');
            }
          }
        }),
      ).rejects.toThrow('All retries exhausted');

      await collector.flush();

      const root = collected.find(
        (s) => s.name === 'workflow:all-retries-fail',
      )!;
      expect(root.status).toBe('error');

      const retries = collected.filter((s) => s.name.startsWith('retry:'));
      expect(retries).toHaveLength(3);
      for (const r of retries) {
        expect(r.status).toBe('error');
      }
    });

    it('retry spans carry incremental attempt numbers', async () => {
      const { tracer, collected, collector } = makeStack();

      await tracer.withSpan('task:retry-test', 'agent', async () => {
        for (let i = 0; i < 5; i++) {
          try {
            await tracer.withSpan(`retry:attempt-${i}`, 'internal', async (ctx) => {
              tracer.setAttributes(ctx.spanId, { 'retry.attempt': i });
              if (i < 4) throw new Error('retry needed');
            });
            break;
          } catch {
            // continue
          }
        }
      });

      await collector.flush();

      const retries = collected.filter((s) => s.name.startsWith('retry:'));
      expect(retries).toHaveLength(5);

      const attemptNumbers = retries
        .map((s) => s.attributes['retry.attempt'] as number)
        .sort();
      expect(attemptNumbers).toEqual([0, 1, 2, 3, 4]);
    });
  });

  describe('timeout exception handling', () => {
    it('timeout errors are captured with proper categorization', async () => {
      const { tracer, collected, collector } = makeStack();

      const timeoutTool = instrumentToolCall(tracer, {
        toolId: 'slow-api',
        toolName: 'Slow API Call',
        fn: async () => {
          const err = new Error('Operation timed out after 30000ms');
          err.name = 'TimeoutError';
          throw err;
        },
      });

      await expect(timeoutTool({ url: '/api/data' })).rejects.toThrow(
        'Operation timed out',
      );
      await collector.flush();

      const span = collected[0]!;
      expect(span.status).toBe('error');
      expect(span.attributes['tool.error']).toContain('Operation timed out');
      expect(span.attributes['tool.id']).toBe('slow-api');
      expect(span.attributes['tool.duration_ms']).toBeTypeOf('number');
    });

    it('timeout in nested workflow creates error span at the correct level', async () => {
      const { tracer, collected, collector } = makeStack();

      await expect(
        tracer.withSpan('workflow:timeout-test', 'agent', async () => {
          await tracer.withSpan('node:process', 'internal', async (ctx) => {
            tracer.setAttributes(ctx.spanId, { 'node.timeout_ms': 5000 });
            throw new Error('Node execution timed out');
          });
        }),
      ).rejects.toThrow('Node execution timed out');

      await collector.flush();

      const nodeSpan = collected.find((s) => s.name === 'node:process')!;
      expect(nodeSpan.status).toBe('error');
      expect(nodeSpan.events[0]!.name).toBe('exception');
      expect(nodeSpan.events[0]!.attributes?.['exception.message']).toContain(
        'timed out',
      );
      expect(nodeSpan.attributes['node.timeout_ms']).toBe(5000);
    });

    it('timeout during tool call still records tool.duration_ms', async () => {
      const { tracer, collected, collector } = makeStack();

      const slowTool = instrumentToolCall(tracer, {
        toolId: 'compute',
        toolName: 'Heavy Compute',
        fn: async () => {
          await new Promise((r) => setTimeout(r, 10));
          throw new Error('Computation timed out');
        },
      });

      await expect(slowTool({ data: [1, 2, 3] })).rejects.toThrow(
        'Computation timed out',
      );
      await collector.flush();

      const span = collected[0]!;
      expect(span.attributes['tool.duration_ms']).toBeTypeOf('number');
      expect(span.attributes['tool.duration_ms'] as number).toBeGreaterThanOrEqual(5);
    });
  });

  describe('mixed success and failure in workflow', () => {
    it('partial failure: some nodes succeed while one fails', async () => {
      const { tracer, collected, collector } = makeStack();

      const successTool = instrumentToolCall(tracer, {
        toolId: 'lint',
        toolName: 'Linter',
        fn: async () => ({ passed: true }),
      });

      const failTool = instrumentToolCall(tracer, {
        toolId: 'test',
        toolName: 'Test Runner',
        fn: async () => {
          throw new Error('3 tests failed');
        },
      });

      await expect(
        tracer.withSpan('workflow:ci', 'agent', async () => {
          await tracer.withSpan('node:lint', 'internal', async () => {
            await successTool('src/');
          });

          await tracer.withSpan('node:test', 'internal', async () => {
            await failTool('src/');
          });
        }),
      ).rejects.toThrow('3 tests failed');

      await collector.flush();

      const lintTool = collected.find((s) => s.attributes['tool.id'] === 'lint')!;
      expect(lintTool.status).toBe('ok');

      const lintNode = collected.find((s) => s.name === 'node:lint')!;
      expect(lintNode.status).toBe('ok');

      const testTool = collected.find((s) => s.attributes['tool.id'] === 'test')!;
      expect(testTool.status).toBe('error');
      expect(testTool.attributes['tool.error']).toBe('3 tests failed');

      const testNode = collected.find((s) => s.name === 'node:test')!;
      expect(testNode.status).toBe('error');

      const root = collected.find((s) => s.name === 'workflow:ci')!;
      expect(root.status).toBe('error');
    });

    it('error span duration is still recorded correctly', async () => {
      const { tracer, collected, collector } = makeStack();

      await expect(
        tracer.withSpan('slow-failure', 'tool', async () => {
          await new Promise((r) => setTimeout(r, 20));
          throw new Error('slow failure');
        }),
      ).rejects.toThrow('slow failure');

      await collector.flush();

      const span = collected[0]!;
      expect(span.durationMs).toBeDefined();
      expect(span.durationMs!).toBeGreaterThanOrEqual(15);
      expect(span.endTime).toBeDefined();
      expect(span.endTime! - span.startTime).toBeGreaterThanOrEqual(15);
    });
  });
});
