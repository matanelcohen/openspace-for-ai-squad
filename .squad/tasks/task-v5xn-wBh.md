---
id: task-v5xn-wBh
title: Test trace visibility end-to-end
status: in-progress
priority: P0
assignee: zoidberg
labels:
  - 'parent:task-T3rsv-au'
created: '2026-04-01T16:45:44.430Z'
updated: '2026-04-01T16:45:44.441Z'
sortIndex: 367
parent: task-T3rsv-au
dependsOn:
  - task-pjGTO5AR
  - task-PpVcjw-d
---
Write tests verifying the improved trace visibility works correctly end-to-end:

1. **Unit tests for enriched attributes** — In the tracing package tests, verify that `instrumentToolCall()` captures all new attributes (`tool.input_preview`, `tool.output_preview`, `tool.input_size_bytes`, `tool.output_size_bytes`, `tool.status`). Verify `instrumentLLMCall()` captures new LLM attributes (`llm.system_prompt_preview`, `llm.response_preview`, `llm.stop_reason`, `llm.temperature`).
2. **Unit tests for preview truncation** — Verify previews are correctly truncated to 200 chars for large inputs/outputs. Verify they handle edge cases: null, undefined, empty string, non-string types (objects, arrays).
3. **API route tests** — Verify `GET /api/traces/:id` returns spans with populated `input`, `output`, `inputPreview`, `outputPreview` fields. Verify aggregate stats (total cost, tokens, duration) are computed correctly.
4. **E2E trace flow test** — Create a test that instruments a mock tool call and LLM call, flushes to the trace store, queries via the API, and verifies all enriched fields appear in the response.
5. **Frontend component tests** — Verify trace-detail renders tool input/output sections, LLM token/cost badges, and error highlighting for failed spans.
