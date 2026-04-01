---
id: task-54IMgbr-
title: Test trace enrichment end-to-end
status: blocked
priority: P0
assignee: zoidberg
labels:
  - 'parent:task-y_tvvXG3'
created: '2026-04-01T11:48:19.188Z'
updated: '2026-04-01T12:37:40.115Z'
sortIndex: 359
parent: task-y_tvvXG3
---
Verify that the trace improvements work end-to-end — from span creation to API to UI rendering:

1. **Unit tests for tool instrumentation** — test that `instrumentToolCall()` creates spans with correct `tool.name`, `tool.input`, `tool.output`, `tool.duration_ms` attributes. Test error cases capture `tool.error` and stack traces.
2. **Unit tests for LLM instrumentation** — test that `instrumentLLMCall()` captures `llm.time_to_first_token_ms` during streaming, and that prompts/responses appear as OTel span attributes.
3. **Integration test: OTLP ingestion** — send a mock OTLP payload to `POST /v1/traces` with tool spans containing `tool.name`, `tool.input`, `tool.output` attributes. Verify `GET /api/traces/:id` returns them correctly in the span tree.
4. **Integration test: HTTP middleware** — make API requests and verify spans are created with `http.method`, `http.route`, `http.status_code`.
5. **Integration test: trace stats** — verify `GET /api/traces/stats` correctly aggregates token counts and costs from enriched spans.
6. **E2E smoke test** — trigger an agent task that uses tools, then fetch the trace via API and assert tool names, inputs, outputs are all present and correctly structured.

Use the existing test framework (vitest for unit/integration, playwright for e2e). Check `vitest.config.ts` and `e2e/` for patterns.

---
**[2026-04-01 12:17:50]** 🚀 Zoidberg started working on this task.
**[2026-04-01 12:17:50]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 12:28:10]** 🚀 Zoidberg started working on this task.
**[2026-04-01 12:28:10]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 12:28:10]** ❌ **BLOCKED** — zoidberg failed.

**Error:** Missing required field "id" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-54IMgbr-.md

**Stack:** ```
Error: Missing required field "id" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-54IMgbr-.md
    at parseTaskFile (/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-54IMgbr-/apps/api/src/services/squad-parser/task-parser.ts:79:11)
    at updateTask (/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-54IMgbr-/apps/api/src/services/squad-writer/task-writer.ts:129:29)
    at AgentWorkerService.processNext (/Users/matancohen/microsof
```

---
**[2026-04-01 12:37:40]** ❌ **BLOCKED** — zoidberg failed.

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
