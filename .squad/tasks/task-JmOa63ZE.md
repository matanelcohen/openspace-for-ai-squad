---
id: task-JmOa63ZE
title: Comprehensive test suite for DAG engine
status: done
priority: P1
assignee: zoidberg
labels:
  - testing
  - unit-tests
  - integration-tests
  - dag
  - 'parent:task-DkHSQ8li'
created: '2026-03-25T23:18:52.941Z'
updated: '2026-03-26T06:57:45.838Z'
sortIndex: 138
---
Write unit and integration tests covering: (1) Graph validation — cycle detection rejects invalid graphs, valid DAGs accepted. (2) Linear execution — steps run in correct order. (3) Parallel fan-out/fan-in — independent branches execute concurrently, join node waits for all parents. (4) Conditional edges — predicates route execution correctly, dead branches are skipped. (5) Checkpoint/resume — executor resumes from last checkpoint after simulated failure. (6) Error handling — step failure propagates correctly, partial results preserved. (7) Edge cases — empty graph, single node, diamond dependencies.

---
**[2026-03-26 06:57:45]** 🚀 Zoidberg started working on this task.

**Progress:**
**[2026-03-26 06:52:35]** 🧠 Thinking: Let me start by understanding the codebase structure, particularly the DAG engine that I need to test. Let me explore the repository first.
**[2026-03-26 06:52:35]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:35]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:40]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:46]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:48]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:48]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:48]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:48]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:48]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:52]** 🧠 Thinking: Now let me read the dag-engine.ts file which is the core engine. It's large (30.6 KB), so I need to read it in parts.
**[2026-03-26 06:52:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:52]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:52:55]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:00]** 🧠 Thinking: Now I have a good understanding of the codebase. Let me read more of the dag-engine.ts to understand the full implementation, especially the execution
**[2026-03-26 06:53:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:00]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:03]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:03]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:03]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:03]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:06]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:06]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:06]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:07]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:07]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:07]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:07]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:10]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:10]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:10]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:10]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:10]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:16]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:16]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:16]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:16]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:19]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:19]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:34]** 🧠 Thinking: Now I have a complete understanding of the DAG engine. Let me also check if there are `activeInterrupts` in the initial state creation - I notice the 
**[2026-03-26 06:53:34]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:34]** 🔧 Using tool: `unknown`
**[2026-03-26 06:53:35]** ℹ️ /Users/matancohen/.copilot/session-state/3d793124-a6cb-433b-9278-7c41bea4197f/plan.md
**[2026-03-26 06:56:18]** 🔧 Using tool: `unknown`
**[2026-03-26 06:56:18]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/packages/shared/src/__tests__/dag-engine-comprehensive.test.ts
**[2026-03-26 06:56:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:56:25]** 🔧 Using tool: `unknown`
**[2026-03-26 06:57:15]** 🧠 Thinking: 3 failures:

1. **Checkpoint/Resume crash test**: The `crashOnFirst` handler only crashes when `callCount === 1 && node.id === 'b'`, but by the time n
**[2026-03-26 06:57:15]** 🔧 Using tool: `unknown`
**[2026-03-26 06:57:15]** 🔧 Using tool: `unknown`
**[2026-03-26 06:57:15]** 🔧 Using tool: `unknown`
**[2026-03-26 06:57:15]** 🔧 Using tool: `unknown`
**[2026-03-26 06:57:26]** 🧠 Thinking: Let me also check if the last event is actually `workflow:completed`. Looking at the engine code more carefully:

```javascript
// After the loop:
sta
**[2026-03-26 06:57:26]** 🔧 Using tool: `unknown`
**[2026-03-26 06:57:33]** 🔧 Using tool: `unknown`

**[2026-03-26 06:57:45]** ✅ Zoidberg completed this task.

**Result:**
All existing tests pass. Here's a summary:

**Created:** `packages/shared/src/__tests__/dag-engine-comprehensive.test.ts` — **41 tests**, all passing.

**Coverage across 7 required areas:**

| Area | Tests | Key scenarios |
|------|-------|---------------|
| **Graph validation** | 12 | 4-node loops, diamonds, fan-out, disconnected components, unknown edges, multiple starts |
| **Linear execution** | 3 | Ordering verified via handler call sequence, predecessor output visibility, snapshot preservation |
| **Parallel fan-out/fan-in** | 5 | Concurrent overlap timestamps, join waits for all parents, `parallel_join` all/any strategies, 5-branch fan-out |
| **Conditional edges** | 3 | Multi-branch predicate routing, default fallthrough, recursive dead-branch skipping |
| **Checkpoint/resume** | 4 | Versioned checkpoints, HITL pause→resume, `recoverState` reset semantics, simulated crash recovery |
| **Error handling** | 5 | `fail_workflow`/`skip`/`continue` policies, retry exhaustion, partial results preserved across parallel failures |
| **Edge cases** | 9 | Empty graph, edges-only graph, single node, diamond deps, start/end only, `maxConcurrency=1`, `getDAGReadyNodes`, event lifecycle, workflow timeout |
