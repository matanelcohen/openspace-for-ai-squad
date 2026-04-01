---
id: task-nXI8Mu8C
title: Test trace visibility end-to-end
status: blocked
priority: P0
assignee: zoidberg
labels:
  - 'parent:task--IVSMCE3'
created: '2026-04-01T11:14:55.156Z'
updated: '2026-04-01T11:35:20.431Z'
sortIndex: 355
parent: task--IVSMCE3
---
Write tests to verify the improved trace instrumentation captures all expected data and the API surfaces it correctly.

1. **Unit tests for buildSpanTree()** in traces route:
   - Test that tool spans with `tool.name`, `tool.input`, `tool.output` attributes are correctly extracted into SpanResponse fields
   - Test that tool spans with missing attributes gracefully degrade (no crashes, shows what's available)
   - Test the new fields: `toolType`, `toolCallId`, `inputSize`, `outputSize`, `statusCode`
   - Test that LLM spans include `tool_calls_count`, `tool_names`, `stop_reason`
   - Test makePreview() generates meaningful previews for various tool input shapes

2. **Unit tests for TraceService aggregation**:
   - Test that `tool_call_count`, `tool_error_count`, `unique_tools_used`, `avg_tool_duration_ms` are correctly computed
   - Test with traces containing mixed tool success/error spans

3. **Integration test for trace pipeline**:
   - Create a mock trace with tool spans via the OTLP collector endpoint (POST /v1/traces)
   - Verify the spans are stored with all attributes
   - Retrieve via GET /api/traces/:id and verify the response includes tool name, input, output, duration, error
   - Verify trace-level aggregates are correct

4. **E2E test (if Playwright is set up)**:
   - Navigate to traces page, verify tool spans show tool name (not just 'tool')
   - Verify clicking a tool span shows input/output in the detail panel
   - Verify the trace summary shows tool call counts

Use the existing test framework (vitest for unit/integration, playwright for e2e). Check existing test patterns in the repo and follow them.

Files to create/modify:
- `apps/api/src/routes/__tests__/traces.test.ts` (or similar path following existing patterns)
- `apps/api/src/services/traces/__tests__/index.test.ts`
- `e2e/traces.spec.ts` (if Playwright e2e tests exist)

---
**[2026-04-01 11:31:36]** 🚀 Zoidberg started working on this task.
**[2026-04-01 11:31:36]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:31:36]** 🚀 Zoidberg started working on this task.
**[2026-04-01 11:31:36]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:31:44]** 🚀 Zoidberg started working on this task.
**[2026-04-01 11:31:44]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:31:44]** 🚀 Zoidberg started working on this task.
**[2026-04-01 11:31:44]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:35:20]** 🚀 Zoidberg started working on this task.
**[2026-04-01 11:35:20]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:35:20]** ❌ **BLOCKED** — zoidberg failed.

**Error:** Missing required field "id" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-nXI8Mu8C.md

**Stack:** ```
Error: Missing required field "id" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-nXI8Mu8C.md
    at parseTaskFile (/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-Rsmthu3S/apps/api/src/services/squad-parser/task-parser.ts:79:11)
    at updateTask (/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-Rsmthu3S/apps/api/src/services/squad-writer/task-writer.ts:129:29)
    at AgentWorkerService.processNext (/Users/matancohen/microsof
```
