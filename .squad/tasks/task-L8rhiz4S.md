---
id: task-L8rhiz4S
title: 'Implement DAG core: graph builder, topological executor, and checkpoint store'
status: done
priority: P1
assignee: bender
labels:
  - backend
  - engine
  - dag
  - parallelism
  - 'parent:task-DkHSQ8li'
created: '2026-03-25T23:18:52.912Z'
updated: '2026-03-26T00:12:31.130Z'
sortIndex: 136
---
Build the backend engine: (1) DAGBuilder API for composing workflows from steps — addStep(), addEdge(), addConditionalEdge(), validate() with cycle detection. (2) DAGExecutor that resolves execution order via topological sort, runs independent steps in parallel (Promise.all or worker pool), evaluates conditional edges, and propagates results through the graph. (3) CheckpointStore interface with an in-memory implementation for persisting execution state at each step so workflows can resume from last checkpoint on failure. Integrate with Tool Registry for step resolution.

---
**[2026-03-26 00:01:49]** 🚀 Bender started working on this task.

---
**[2026-03-26 00:12:31]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-26 00:05:42]** 🧠 Thinking: Let me understand the task: I need to implement a DAG (Directed Acyclic Graph) core engine with three main components:

1. **DAGBuilder** - API for co
**[2026-03-26 00:05:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:50]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:50]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:50]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:57]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:19]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:24]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:28]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:34]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:34]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:34]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:34]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:34]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:34]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:42]** 🧠 Thinking: There's already a workflow/ directory with checkpoint.ts, dag-builder.ts, dag-engine.ts, dag-executor.ts, etc. Let me read all the existing files to u
**[2026-03-26 00:07:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:48]** 🧠 Thinking: Now let me look at the dag-engine.ts (the large file) and the types:
**[2026-03-26 00:07:48]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:48]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:48]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:55]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:07]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:11]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:38]** 🧠 Thinking: Now I have a very thorough understanding of the codebase. The DAG core engine is already largely implemented:

1. **DAGBuilder** (`dag-builder.ts`) - 
**[2026-03-26 00:08:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:38]** ℹ️ /Users/matancohen/.copilot/session-state/6da4bab7-d245-451d-8870-93928902a60a/plan.md
**[2026-03-26 00:11:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:17]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/shared/src/__tests__/dag-builder.test.ts
**[2026-03-26 00:11:17]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/shared/src/__tests__/dag-engine.test.ts
**[2026-03-26 00:11:17]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/shared/src/__tests__/checkpoint.test.ts
**[2026-03-26 00:11:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:59]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/shared/src/__tests__/parameter-resolver.test.ts
**[2026-03-26 00:11:59]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/shared/src/__tests__/predicate-evaluator.test.ts
**[2026-03-26 00:12:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:16]** 🔧 Using tool: `unknown`

**[2026-03-26 00:12:31]** ✅ Bender completed this task.

**Result:**
Pre-existing type error in escalation code (not my code). My tests all pass, types are clean for the workflow module.

Done. Here's the summary:

**All three DAG core components were already implemented:**
- `dag-builder.ts` — DAGBuilder with `addStep()`, `addEdge()`, `addConditionalEdge()`, `validate()`, cycle detection, auto start/end sentinels
- `dag-engine.ts` — DAGWorkflowEngine with topological levels, parallel batch execution (Promise.allSettled), conditional edge evaluation, retry/timeout, HITL gates, failure policies
- `dag-executor.ts` — DAGExecutor facade wrapping the engine with Tool Registry integration
- `checkpoint.ts` — InMemoryCheckpointStore implementing CheckpointStore interface + crash recovery

**What I added:** 132 tests across 5 new test files:
- `dag-builder.test.ts` (23 tests) — addStep, addEdge, addConditionalEdge, validate, build, cycle detection, remove operations
- `dag-engine.test.ts` (29 tests) — graph utilities, linear/parallel execution, tool registry integration, failure policies, retry, conditional edges, HITL gates, cancel, events
- `checkpoint.test.ts` (23 tests) — save/load, versioning, listVersions, delete, prune, recoverState, serialization
- `predicate-evaluator.test.ts` (25 tests) — comparison operators, field resolution, AND/OR/NOT combinators, nested predicates
- `parameter-resolver.test.ts` (12 tests) — static params, dynamic mappings, bracket notation, secrets resolution
