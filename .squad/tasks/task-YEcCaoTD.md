---
id: task-YEcCaoTD
title: Test improved trace feature end-to-end
status: blocked
priority: P0
assignee: zoidberg
labels:
  - 'parent:task-gQvmERyq'
created: '2026-04-01T09:19:43.971Z'
updated: '2026-04-01T09:23:40.325Z'
sortIndex: 347
parent: task-gQvmERyq
---
Write and run tests validating the trace improvements work correctly:

1. **Backend API tests**: Test that `GET /api/traces/:id` returns spans with properly populated fields: `input`, `output`, `inputPreview`, `outputPreview`, `inputSize`, `outputSize`, `events`, per-span tokens/cost. Test with tool spans, LLM spans, error spans, and nested spans. Verify tool.name is correctly extracted.
2. **Frontend component tests**: Test the trace-detail component renders:
   - Actual tool names (not 'tool') in the waterfall
   - Inline input/output previews on span rows
   - Copy buttons in the detail panel
   - Events tab with event data
   - Kind filter badges toggle visibility correctly
   - Error spans show expanded error details
3. **Visual regression / snapshot**: Verify the waterfall renders correctly with the new inline data without layout overflow or truncation issues.
4. **Edge cases**: Test spans with no input, no output, very large input/output (should truncate), null events, missing attributes.

Key files: `apps/api/src/routes/__tests__/`, `apps/web/src/components/traces/__tests__/`, `e2e/`.

---
**[2026-04-01 09:23:40]** 🚀 Zoidberg started working on this task.

---
**[2026-04-01 09:23:40]** ❌ **BLOCKED** — zoidberg failed.

**Error:** Missing required field "id" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-YEcCaoTD.md

**Stack:** ```
Error: Missing required field "id" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-YEcCaoTD.md
    at parseTaskFile (/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-JsqC2pkp/apps/api/src/services/squad-parser/task-parser.ts:79:11)
    at updateTask (/Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-JsqC2pkp/apps/api/src/services/squad-writer/task-writer.ts:129:29)
    at AgentWorkerService.processNext (/Users/matancohen/microsof
```
