---
id: task-np7Ihbqf
title: Enrich trace span data extraction and API response
status: blocked
priority: P0
assignee: bender
labels:
  - 'parent:task-DEDTW7M7'
created: '2026-04-01T09:31:26.799Z'
updated: '2026-04-01T09:43:42.758Z'
sortIndex: 349
parent: task-DEDTW7M7
---
Improve the backend span-to-response transformation in `apps/api/src/routes/traces.ts` (buildSpanTree function, lines 78-200) and the tracing instrumentation in `packages/tracing/src/instrument-tool.ts`. Key changes:

1. **Always surface tool name**: In the span response, add a top-level `toolName` field extracted from `attrs['tool.name']` so the frontend can display it prominently instead of just showing 'tool' as the kind badge. Also extract `tool.id`.
2. **Ensure input/output never silently null**: When `tool.input`/`tool.output` are missing, populate input with a structured fallback showing all available tool attributes (tool.name, tool.id, any arguments) rather than null.
3. **Parse and surface span events**: Currently only exception events are extracted from the `events` JSON array. Parse ALL events and include them in the span response as a new `events` field — these could include log messages, state transitions, retries, etc. Add an `events` field to the SpanResponse type.
4. **Add structured tool metadata**: Extract and surface `tool.duration_ms`, parameter count, input/output byte sizes, and any custom attributes prefixed with `tool.` into a dedicated `toolInfo` object in the response.
5. **Enrich LLM spans**: Add `messageCount` (number of messages in prompt), `responseLength` (char count of response), `tokensPerSecond` (completion_tokens / duration) to give better LLM performance visibility.
6. **Update the Span response type** in `apps/web/src/lib/trace-types.ts` to include the new fields: `toolName`, `toolId`, `events`, `toolInfo`, `llmInfo`.

Files to modify:
- `apps/api/src/routes/traces.ts` — buildSpanTree function
- `packages/tracing/src/types.ts` — add event types if needed
- `apps/web/src/lib/trace-types.ts` — update Span interface
- `apps/web/src/lib/mock-traces.ts` — update mock data to include new fields

---
**[2026-04-01 09:31:26]** 🚀 Bender started working on this task.
**[2026-04-01 09:31:26]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 09:36:17]** 🚀 Bender started working on this task.
**[2026-04-01 09:36:17]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 09:36:17]** 🚀 Bender started working on this task.
**[2026-04-01 09:36:17]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 09:36:41]** 🚀 Bender started working on this task.
**[2026-04-01 09:36:41]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 09:36:41]** 🚀 Bender started working on this task.
**[2026-04-01 09:36:41]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 09:36:43]** 🛑 Permanently blocked after 5 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.

---
**[2026-04-01 09:43:42]** ❌ **BLOCKED** — bender failed.

**Error:** spawnSync /bin/sh ENOENT

**Stack:** ```
Error: spawnSync /bin/sh ENOENT
    at Object.spawnSync (node:internal/child_process:1120:20)
    at spawnSync (node:child_process:902:24)
    at execSync (node:child_process:983:15)
    at WorktreeService.gitInDir (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/worktree/index.ts:497:12)
    at WorktreeService.commit (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/worktree/index.ts:238:25)
    at AgentWorkerService.processNext (/Users/matancohe
```
