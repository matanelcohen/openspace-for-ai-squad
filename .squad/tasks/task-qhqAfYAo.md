---
id: task-qhqAfYAo
title: Implement tracing SDK & instrumentation layer
status: done
priority: P0
assignee: bender
labels:
  - backend
  - sdk
  - observability
  - instrumentation
  - 'parent:task-oJQ0IYQc'
created: '2026-03-25T23:19:09.221Z'
updated: '2026-03-31T21:51:04.847Z'
sortIndex: 92
---
Build a tracing SDK that agents use to emit spans. Implement: (1) A `Tracer` class with `startSpan()`, `endSpan()`, `recordEvent()` methods. (2) Middleware/wrapper for tool calls that auto-captures input, output, latency, and errors. (3) LLM call instrumentation that captures model name, token counts (prompt/completion), cost calculation, and streaming latency. (4) A `TraceCollector` that batches and persists traces to the backend. (5) Context propagation so nested spans (agent → reasoning → tool call → LLM) form a proper tree. Include cost calculation using a configurable price table per model.

---
**[2026-03-26 00:12:33]** 🚀 Bender started working on this task.

---
**[2026-03-26 00:18:42]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-26 00:17:56]** 🧠 Thinking: Let me analyze this task. I need to build a tracing SDK and instrumentation layer for the openspace.ai project. Let me first explore the codebase to u
**[2026-03-26 00:17:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:17:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:17:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:17:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:17:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:00]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:00]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:00]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:00]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:00]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:13]** 🧠 Thinking: Good, there's already a `packages/tracing` directory with skeleton files. Let me see what's already there.
**[2026-03-26 00:18:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:20]** 🧠 Thinking: The code is already scaffolded. Let me check if the test files have actual content or are just stubs.
**[2026-03-26 00:18:20]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:20]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:20]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:20]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:20]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:27]** 🧠 Thinking: The entire tracing package is already fully implemented with both source code and tests. Let me run the tests to see if they pass.
**[2026-03-26 00:18:27]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:27]** 🔧 Using tool: `unknown`
**[2026-03-26 00:18:32]** 🔧 Using tool: `unknown`

**[2026-03-26 00:18:42]** ✅ Bender completed this task.

**Result:**
All 30 tests pass and typecheck is clean. The tracing SDK is fully implemented:

| Module | What it does |
|---|---|
| **`Tracer`** | `startSpan()`, `endSpan()`, `recordEvent()`, `setAttributes()`, `withSpan()` — auto context propagation via `AsyncLocalStorage` |
| **`TraceCollector`** | Batches spans, flushes by size or interval, retries on sink failure, `shutdown()` for graceful drain |
| **`instrumentToolCall`** | Wraps tool functions — auto-captures input, output, latency, errors as span attributes |
| **`instrumentLLMCall`** | Wraps LLM calls — captures model, provider, token counts, cost (USD), streaming events, duration |
| **`calculateCost` / `DEFAULT_PRICE_TABLE`** | Configurable price table with prefix matching (e.g. `gpt-4o-2024-05-13` → `gpt-4o`) |
| **`span-context`** | `AsyncLocalStorage`-based propagation — nested spans (agent → reasoning → tool → LLM) form a proper tree |

5 test files, 30 tests, all green. Zero type errors.
