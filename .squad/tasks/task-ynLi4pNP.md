---
id: task-ynLi4pNP
title: E2E tests & integration validation for tracing
status: done
priority: P1
assignee: zoidberg
labels:
  - testing
  - e2e
  - integration-tests
  - observability
  - 'parent:task-oJQ0IYQc'
created: '2026-03-25T23:19:09.264Z'
updated: '2026-03-31T21:51:04.850Z'
sortIndex: 94
---
Write comprehensive tests: (1) Unit tests for the Tracer SDK - span creation, nesting, context propagation, cost calculation, token counting. (2) Integration tests verifying traces are correctly emitted during real agent runs and persisted via the API. (3) E2E tests for the trace viewer UI - verify trace list loads, filtering works, clicking a trace shows the waterfall view, span details render correctly. (4) Performance test ensuring tracing overhead stays under 5% of baseline agent latency. (5) Test edge cases: failed spans, concurrent traces, very deep span trees, missing data gracefully handled in UI.

---
**[2026-03-26 07:04:45]** 🚀 Zoidberg started working on this task.

**Progress:**
**[2026-03-26 06:57:55]** 🧠 Thinking: Let me analyze this task. I need to write comprehensive tests for a tracing system in this monorepo. Let me first explore the codebase to understand t
**[2026-03-26 06:57:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:57:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:57:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:57:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:57:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:05]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:05]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:05]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:19]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:19]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:23]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:23]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:30]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:30]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:30]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:30]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:30]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:30]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:30]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:34]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:34]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:34]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:34]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:34]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:34]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:51]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:51]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:51]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:51]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:56]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:56]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:56]** 🔧 Using tool: `unknown`
**[2026-03-26 06:58:56]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:04]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:04]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:27]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:39]** 🧠 Thinking: Now I have a comprehensive understanding of the codebase. Let me now read the actual source files I need to write tests against, to get the exact API 
**[2026-03-26 06:59:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:39]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:45]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:56]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:56]** 🔧 Using tool: `unknown`
**[2026-03-26 06:59:56]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:01]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:01]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:01]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:07]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:12]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:19]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:28]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:51]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:51]** ℹ️ /Users/matancohen/.copilot/session-state/bee9c6d8-5ed9-4ee3-8366-a7260665322c/plan.md
**[2026-03-26 07:00:56]** 🔧 Using tool: `unknown`
**[2026-03-26 07:00:56]** 🔧 Using tool: `unknown`
**[2026-03-26 07:01:01]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:03]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/tracing/src/__tests__/tracer-edge-cases.test.ts
**[2026-03-26 07:04:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/tracing/src/__tests__/cost-calculator-edge-cases.test.ts
**[2026-03-26 07:04:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/tracing/src/__tests__/performance.test.ts
**[2026-03-26 07:04:03]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/e2e/trace-viewer.spec.ts
**[2026-03-26 07:04:04]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/tracing/src/__tests__/integration.test.ts
**[2026-03-26 07:04:11]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:11]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:23]** 🔧 Using tool: `unknown`
**[2026-03-26 07:04:33]** 🔧 Using tool: `unknown`

**[2026-03-26 07:04:45]** ✅ Zoidberg completed this task.

**Result:**
Here's what I delivered — **5 new test files, 47 new tests** (105 total, up from 58):

### New test files

| File | Tests | Coverage |
|------|-------|----------|
| `packages/tracing/src/__tests__/tracer-edge-cases.test.ts` | 19 | Failed spans (Error, string, null), concurrent traces (isolation, no context leak), 50-level deep nesting, double-end/unknown-span no-ops, LLM token promotion (partial, non-numeric, zero), timing, manual context propagation |
| `packages/tracing/src/__tests__/cost-calculator-edge-cases.test.ts` | 18 | Zero/large tokens, unknown models, prefix matching, custom price tables, float precision, table integrity |
| `packages/tracing/src/__tests__/integration.test.ts` | 8 | Full Tracer→Collector→Store pipeline, multi-span trace assembly, token/cost aggregation, run lifecycle (running→completed/failed), batch-flush persistence, sink retry |
| `packages/tracing/src/__tests__/performance.test.ts` | 4 | Overhead <5% of baseline, sub-ms span ops (0.008ms/span), 100-level deep nesting (<1ms), 50 concurrent traces |
| `e2e/trace-viewer.spec.ts` | 18 | Trace list (load, search, filters, sort, tabs), trace detail (navigation, waterfall, span detail panel, tab switching, back button, 404), statistics (KPIs, charts), edge cases (running/error indicators) |
