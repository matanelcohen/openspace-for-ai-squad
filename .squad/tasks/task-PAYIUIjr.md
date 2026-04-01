---
id: task-PAYIUIjr
title: Test tracing instrumentation end-to-end
status: blocked
priority: P0
assignee: zoidberg
labels:
  - 'parent:task-SiMXgoA_'
created: '2026-04-01T18:26:42.795Z'
updated: '2026-04-01T19:12:05.032Z'
sortIndex: 375
parent: task-SiMXgoA_
dependsOn:
  - task-xQTJAk3T
  - task-muZOvv3R
---
Verify that the new tracing spans are correctly created, contain the right attributes, and display properly in the UI.

Tests needed:
1. **Unit tests for DAG engine tracing** — Mock the tracer and verify that executing a DAG with tool calls creates the expected span hierarchy: workflow root → node spans → tool call spans. Assert each tool span has: tool.id, tool.name, tool.input (full params), tool.output (full result), tool.duration_ms, and correct status.
2. **Unit tests for agent worker tracing** — Verify spans are created for task processing with queue_wait_ms attribute, memory recall spans, skill matching spans, and delegation spans.
3. **Unit tests for error tracing** — Trigger tool failures and verify: error spans have full stack traces in events, retry attempts create individual child spans, timeout exceptions are properly categorized.
4. **Integration test** — Execute a real agent task flow and verify the trace written to SQLite contains all expected spans with correct parent-child relationships. Query the traces API and verify the response includes tool inputs/outputs.
5. **UI smoke test** — If Playwright e2e tests exist (check `/e2e/`), add a test that navigates to a trace detail page and verifies: span tree renders, clicking a tool span shows input/output JSON, cost summary displays correctly.

Use the existing test infrastructure (vitest for unit, playwright for e2e). Check `/packages/tracing/src/__tests__/` for existing trace tests to follow patterns.

---
**[2026-04-01 18:59:01]** 🚀 Zoidberg started working on this task.
**[2026-04-01 18:59:01]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 19:11:36]** 🚀 Zoidberg started working on this task.
**[2026-04-01 19:11:36]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 19:11:38]** 🚀 Zoidberg started working on this task.
**[2026-04-01 19:11:38]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 19:11:38]** 🚀 Zoidberg started working on this task.
**[2026-04-01 19:11:38]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 19:11:38]** 🚀 Zoidberg started working on this task.
**[2026-04-01 19:11:38]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 19:11:42]** 🚀 Zoidberg started working on this task.
**[2026-04-01 19:11:42]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 19:11:42]** 🚀 Zoidberg started working on this task.
**[2026-04-01 19:11:42]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 19:11:47]** 🚀 Zoidberg started working on this task.
**[2026-04-01 19:11:47]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 19:11:49]** 🚀 Zoidberg started working on this task.
**[2026-04-01 19:11:49]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 19:11:56]** 🚀 Zoidberg started working on this task.
**[2026-04-01 19:11:56]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 19:11:57]** 🚀 Zoidberg started working on this task.
**[2026-04-01 19:11:57]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 19:12:05]** 🛑 Blocked after 5 execution attempts.

**Last error:** Max attempts reached
