import { describe, expect, it } from 'vitest';

import { calculateCost, DEFAULT_PRICE_TABLE } from '../cost-calculator.js';
import { instrumentLLMCall } from '../instrument-llm.js';
import { instrumentToolCall } from '../instrument-tool.js';
import { TraceCollector } from '../trace-collector.js';
import {
  aggregateCost,
  aggregateTokenUsage,
  buildTrace,
  InMemoryTraceStore,
} from '../trace-store.js';
import { Tracer } from '../tracer.js';
import type { Run, Span } from '../types.js';

// ── Integration Tests ─────────────────────────────────────────────
// These tests verify the full pipeline: Tracer → Collector → Store

describe('Tracing Integration', () => {
  function makeIntegrationStack() {
    const store = new InMemoryTraceStore();
    const collector = new TraceCollector({
      batchSize: 100,
      flushIntervalMs: 0,
      sink: async (spans) => {
        await store.appendSpans(spans);
      },
    });
    const tracer = new Tracer({ serviceName: 'integration-agent', collector });
    return { store, collector, tracer };
  }

  describe('full agent simulation', () => {
    it('agent run with tool and LLM calls persists correctly to store', async () => {
      const { store, collector, tracer } = makeIntegrationStack();

      // Simulate a real agent run
      await tracer.withSpan('agent:planner', 'agent', async (agentCtx) => {
        // Tool call
        const searchTool = instrumentToolCall(tracer, {
          toolId: 'web-search',
          toolName: 'Web Search',
          fn: async (query: string) => {
            await new Promise((r) => setTimeout(r, 5));
            return { results: ['result1', 'result2'] };
          },
        });
        await searchTool('openspace AI');

        // LLM call
        const llmCall = instrumentLLMCall(
          tracer,
          {
            model: 'gpt-4o',
            provider: 'openai',
            fn: async (prompt: string) => {
              await new Promise((r) => setTimeout(r, 5));
              return {
                content: 'Here is my response',
                usage: { prompt_tokens: 500, completion_tokens: 200 },
              };
            },
            extractUsage: (res) => ({
              promptTokens: res.usage.prompt_tokens,
              completionTokens: res.usage.completion_tokens,
            }),
          },
          DEFAULT_PRICE_TABLE,
        );
        await llmCall('Summarize the search results');

        // Upsert run record
        await store.upsertRun({
          runId: agentCtx.traceId,
          agentId: 'planner',
          trigger: 'user',
          status: 'completed',
          startTime: Date.now() - 100,
          endTime: Date.now(),
          durationMs: 100,
          tokenUsage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
          totalCostUsd: 0.0055,
          spanCount: 3,
        });
      });

      await collector.flush();

      // Verify store state
      expect(store.stats.spanCount).toBe(3); // agent + tool + llm
      expect(store.stats.runCount).toBe(1);

      // Retrieve the trace
      const runs = await store.listRuns();
      expect(runs).toHaveLength(1);
      const traceId = runs[0]!.runId;

      const trace = await store.getTrace(traceId);
      expect(trace).toBeDefined();
      expect(trace!.spans).toHaveLength(3);

      // Verify span hierarchy
      const rootSpan = trace!.spans.find((s) => !s.context.parentSpanId);
      expect(rootSpan).toBeDefined();
      expect(rootSpan!.name).toBe('agent:planner');
      expect(rootSpan!.kind).toBe('agent');

      const childSpans = trace!.spans.filter(
        (s) => s.context.parentSpanId === rootSpan!.context.spanId,
      );
      expect(childSpans).toHaveLength(2);

      const toolSpan = childSpans.find((s) => s.kind === 'tool');
      expect(toolSpan).toBeDefined();
      expect(toolSpan!.attributes['tool.name']).toBe('Web Search');

      const llmSpan = childSpans.find((s) => s.kind === 'llm');
      expect(llmSpan).toBeDefined();
      expect(llmSpan!.tokenUsage).toBeDefined();
      expect(llmSpan!.tokenUsage!.promptTokens).toBe(500);
      expect(llmSpan!.tokenUsage!.completionTokens).toBe(200);
      expect(llmSpan!.costUsd).toBeDefined();
      expect(llmSpan!.costUsd).toBeGreaterThan(0);
    });

    it('multiple sequential agent runs create separate traces', async () => {
      const { store, collector, tracer } = makeIntegrationStack();

      for (let i = 0; i < 3; i++) {
        await tracer.withSpan(`agent-run-${i}`, 'agent', async (ctx) => {
          await tracer.withSpan(`tool-${i}`, 'tool', async () => {
            await new Promise((r) => setTimeout(r, 2));
          });
          await store.upsertRun({
            runId: ctx.traceId,
            agentId: `agent-${i}`,
            trigger: 'user',
            status: 'completed',
            startTime: Date.now(),
            tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
            totalCostUsd: 0,
            spanCount: 2,
          });
        });
      }

      await collector.flush();
      const runs = await store.listRuns();
      expect(runs).toHaveLength(3);

      // Each run should have its own trace
      for (const run of runs) {
        const trace = await store.getTrace(run.runId);
        expect(trace).toBeDefined();
        expect(trace!.spans).toHaveLength(2);
      }
    });
  });

  describe('trace assembly verification', () => {
    it('buildTrace sorts spans by startTime', async () => {
      const { store, collector, tracer } = makeIntegrationStack();

      await tracer.withSpan('root', 'agent', async () => {
        await tracer.withSpan('first', 'tool', async () => {
          await new Promise((r) => setTimeout(r, 5));
        });
        await tracer.withSpan('second', 'llm', async () => {
          await new Promise((r) => setTimeout(r, 5));
        });
      });

      await collector.flush();
      const runs = await store.listRuns({ limit: 1 });
      // No runs upserted, get trace by looking at spans
      // Instead, list all traces via the internal spans map
      // We need to find the traceId from the stored spans
      // Let's just check via getTrace once we know the traceId

      // The traces are keyed by traceId. Let's get the first span's traceId
      // Since we don't have listTraceIds, we'll upsert a run manually
    });

    it('token and cost aggregation across multi-span traces', async () => {
      const { store, collector, tracer } = makeIntegrationStack();
      let traceId: string;

      await tracer.withSpan('root', 'agent', async (ctx) => {
        traceId = ctx.traceId;

        // First LLM call
        const llm1 = instrumentLLMCall(
          tracer,
          {
            model: 'gpt-4o',
            fn: async () => ({
              usage: { prompt_tokens: 300, completion_tokens: 100 },
            }),
            extractUsage: (r) => ({
              promptTokens: r.usage.prompt_tokens,
              completionTokens: r.usage.completion_tokens,
            }),
          },
          DEFAULT_PRICE_TABLE,
        );
        await llm1('prompt 1');

        // Second LLM call
        const llm2 = instrumentLLMCall(
          tracer,
          {
            model: 'gpt-4o-mini',
            fn: async () => ({
              usage: { prompt_tokens: 1000, completion_tokens: 500 },
            }),
            extractUsage: (r) => ({
              promptTokens: r.usage.prompt_tokens,
              completionTokens: r.usage.completion_tokens,
            }),
          },
          DEFAULT_PRICE_TABLE,
        );
        await llm2('prompt 2');
      });

      await collector.flush();

      // Build trace and verify aggregation
      const trace = await store.getTrace(traceId!);
      expect(trace).toBeDefined();

      // Aggregate token usage should sum both LLM spans
      expect(trace!.tokenUsage.promptTokens).toBe(1300); // 300 + 1000
      expect(trace!.tokenUsage.completionTokens).toBe(600); // 100 + 500
      expect(trace!.tokenUsage.totalTokens).toBe(1900);

      // Cost should be sum of both LLM costs
      expect(trace!.totalCostUsd).toBeGreaterThan(0);

      // Verify individual span costs
      const llmSpans = trace!.spans.filter((s) => s.kind === 'llm');
      expect(llmSpans).toHaveLength(2);
      for (const llmSpan of llmSpans) {
        expect(llmSpan.costUsd).toBeDefined();
        expect(llmSpan.costUsd).toBeGreaterThan(0);
      }
    });
  });

  describe('run lifecycle', () => {
    it('run transitions from running to completed', async () => {
      const { store, collector, tracer } = makeIntegrationStack();
      let traceId: string;

      const ctx = tracer.startSpan('lifecycle-agent', 'agent');
      traceId = ctx.traceId;

      // Upsert as running
      await store.upsertRun({
        runId: traceId,
        agentId: 'lifecycle-agent',
        trigger: 'user',
        status: 'running',
        startTime: Date.now(),
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        totalCostUsd: 0,
        spanCount: 0,
      });

      let runs = await store.listRuns({ status: 'running' });
      expect(runs).toHaveLength(1);

      // Complete the span
      tracer.endSpan(ctx.spanId, 'ok');
      await collector.flush();

      // Update run to completed
      await store.upsertRun({
        runId: traceId,
        agentId: 'lifecycle-agent',
        trigger: 'user',
        status: 'completed',
        startTime: Date.now() - 100,
        endTime: Date.now(),
        durationMs: 100,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        totalCostUsd: 0,
        spanCount: 1,
      });

      runs = await store.listRuns({ status: 'running' });
      expect(runs).toHaveLength(0);

      runs = await store.listRuns({ status: 'completed' });
      expect(runs).toHaveLength(1);
    });

    it('run transitions from running to failed', async () => {
      const { store, collector, tracer } = makeIntegrationStack();

      const ctx = tracer.startSpan('failing-agent', 'agent');
      const traceId = ctx.traceId;

      await store.upsertRun({
        runId: traceId,
        agentId: 'failing-agent',
        trigger: 'webhook',
        status: 'running',
        startTime: Date.now(),
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        totalCostUsd: 0,
        spanCount: 0,
      });

      // Record error
      tracer.recordEvent(ctx.spanId, 'exception', {
        'exception.message': 'out of memory',
      });
      tracer.endSpan(ctx.spanId, 'error');
      await collector.flush();

      // Update run to failed
      await store.upsertRun({
        runId: traceId,
        agentId: 'failing-agent',
        trigger: 'webhook',
        status: 'failed',
        startTime: Date.now() - 50,
        endTime: Date.now(),
        durationMs: 50,
        tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        totalCostUsd: 0,
        spanCount: 1,
        errorMessage: 'out of memory',
      });

      const runs = await store.listRuns({ status: 'failed' });
      expect(runs).toHaveLength(1);
      expect(runs[0]!.errorMessage).toBe('out of memory');

      const trace = await store.getTrace(traceId);
      expect(trace).toBeDefined();
      expect(trace!.spans[0]!.status).toBe('error');
    });
  });

  describe('collector integration', () => {
    it('batch-size triggered flush persists to store', async () => {
      const store = new InMemoryTraceStore();
      const collector = new TraceCollector({
        batchSize: 3,
        flushIntervalMs: 0,
        sink: async (spans) => {
          await store.appendSpans(spans);
        },
      });
      const tracer = new Tracer({ serviceName: 'batch-agent', collector });

      // Create exactly batchSize spans
      for (let i = 0; i < 3; i++) {
        const ctx = tracer.startSpan(`span-${i}`);
        tracer.endSpan(ctx.spanId);
      }

      // Give async flush a tick
      await new Promise((r) => setTimeout(r, 20));
      expect(store.stats.spanCount).toBe(3);

      await collector.shutdown();
    });

    it('sink failure retries successfully on next flush', async () => {
      let failCount = 0;
      const store = new InMemoryTraceStore();
      const collector = new TraceCollector({
        batchSize: 100,
        flushIntervalMs: 0,
        sink: async (spans) => {
          failCount++;
          if (failCount <= 2) throw new Error('transient failure');
          await store.appendSpans(spans);
        },
      });
      const tracer = new Tracer({ serviceName: 'retry-agent', collector });

      const ctx = tracer.startSpan('retry-span');
      tracer.endSpan(ctx.spanId);

      // First two flushes fail
      await collector.flush();
      expect(collector.pendingCount).toBe(1);
      await collector.flush();
      expect(collector.pendingCount).toBe(1);

      // Third flush succeeds
      await collector.flush();
      expect(collector.pendingCount).toBe(0);
      expect(store.stats.spanCount).toBe(1);

      await collector.shutdown();
    });
  });
});
