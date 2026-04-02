---
id: task-vkuviobY
title: Truncate span attributes and add error recording
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-h4zvhYWj'
created: '2026-04-02T11:06:58.886Z'
updated: '2026-04-02T11:11:32.377Z'
sortIndex: 75
parent: task-h4zvhYWj
---
In packages/tracing/src/instrument-llm.ts (lines 41,79) and instrument-tool.ts (lines 33,59), full LLM input/output is stored as span attributes with no size limit. Fix: 1) Create a shared truncateAttribute(value, maxBytes=4096) helper that truncates strings to ~4KB with a '[truncated]' suffix. 2) Apply it to all span attribute sets in instrument-llm.ts and instrument-tool.ts where LLM input/output/prompt/completion is stored. 3) Add try-catch with span.recordException() and span.setStatus({code: SpanStatusCode.ERROR}) to instrument-llm.ts, matching the pattern already used in instrument-tool.ts. Ensure the original function's error is re-thrown after recording.

---
**[2026-04-02 11:11:17]** 🚀 Bender started working on this task.
**[2026-04-02 11:11:17]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:11:32]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
