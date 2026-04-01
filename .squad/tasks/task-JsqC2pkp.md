---
id: task-JsqC2pkp
title: Enhance trace API span data extraction
status: blocked
priority: P0
assignee: bender
labels:
  - 'parent:task-gQvmERyq'
created: '2026-04-01T09:19:43.950Z'
updated: '2026-04-01T09:23:40.328Z'
sortIndex: 345
parent: task-gQvmERyq
---
Fix and improve how span data is extracted and returned by the trace API:

1. **Fix tool name display**: In `apps/api/src/routes/traces.ts`, ensure `tool.name` attribute is properly extracted and set as the span's `name` field (not just 'tool'). Map `tool:toolName` span names to display the actual tool name prominently.
2. **Enrich span response payload**: For tool spans, ensure `input`, `output`, and `error` are always populated from `tool.input`/`tool.output`/`tool.error` attributes. For LLM spans, extract and surface `llm.model`, `llm.time_to_first_token_ms`, `llm.streaming`, `llm.provider` as top-level fields.
3. **Add new computed fields to the span response**: Add `inputPreview` (truncated string summary of input, max 120 chars), `outputPreview` (truncated string summary of output, max 120 chars), and `inputSize`/`outputSize` (byte sizes of serialized input/output).
4. **Surface span events**: The `events` field in SpanRecord contains exception events and streaming events but they're never returned to the frontend. Parse the JSON events array and include it in the span response object.
5. **Add token cost breakdown per span**: Include per-span token counts and cost in the response (currently only aggregated at trace level).

Key files: `apps/api/src/routes/traces.ts`, `apps/api/src/services/traces/index.ts`, `apps/web/src/lib/trace-types.ts` (update types to match new fields).

---
**[2026-04-01 09:19:43]** 🚀 Bender started working on this task.
**[2026-04-01 09:19:43]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 09:20:09]** 🚀 Bender started working on this task.
**[2026-04-01 09:20:09]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 09:23:40]** 🚀 Bender started working on this task.

---
**[2026-04-01 09:23:40]** ❌ **BLOCKED** — bender failed.

**Error:** Missing required field "id" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-JsqC2pkp.md

**Stack:** ```
Error: Missing required field "id" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-JsqC2pkp.md
    at parseTaskFile (/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-JsqC2pkp/apps/api/src/services/squad-parser/task-parser.ts:79:11)
    at updateTask (/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-JsqC2pkp/apps/api/src/services/squad-writer/task-writer.ts:129:29)
    at AgentWorkerService.processNext (/Users/matancohen/microsof
```
