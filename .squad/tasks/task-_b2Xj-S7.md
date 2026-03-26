---
id: task-_b2Xj-S7
title: Design tracing data model & architecture
status: blocked
priority: P0
assignee: leela
labels:
  - architecture
  - observability
  - data-model
  - 'parent:task-oJQ0IYQc'
created: '2026-03-25T23:19:09.203Z'
updated: '2026-03-26T00:49:36.116Z'
sortIndex: 139
---
Define the schema for trace data: runs, spans, steps (reasoning, tool calls, LLM calls). Each span captures: start/end timestamps, token usage (prompt + completion), latency, cost, parent span ID, metadata, and status. Design the storage strategy (e.g., append-only trace log, indexed by run ID). Define the TypeScript interfaces/types for Trace, Span, and Step. Document the architecture in a lightweight ADR covering: data flow from agent → collector → storage → UI, retention policy, and performance budget (tracing overhead < 5% of agent latency).

---
**[2026-03-26 00:38:30]** 🚀 Leela started working on this task.

---
**[2026-03-26 00:44:37]** 🚀 Leela started working on this task.

---
**[2026-03-26 00:47:01]** 🚀 Leela started working on this task.

---
**[2026-03-26 00:49:36]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
