---
id: task-Rsmthu3S
title: Enrich backend trace instrumentation
status: blocked
priority: P0
assignee: bender
labels:
  - 'parent:task--IVSMCE3'
created: '2026-04-01T11:14:53.498Z'
updated: '2026-04-01T11:31:44.654Z'
sortIndex: 353
parent: task--IVSMCE3
---
Improve the tracing backend for much richer tool span data. Key changes:

1. **Fix tool span data capture in copilot-provider.ts**: The `tool.execution_start` and `tool.result` event handlers sometimes fail to extract tool name/input/output because the SDK event shape varies. Add robust fallback extraction from the LLM response's `tool_calls` array — when the model returns structured tool_calls in the completion response, create explicit tool spans with full input/output even if events don't fire.

2. **Add new high-value attributes to tool spans**:
   - `tool.call_id` — the unique tool call ID from the LLM response (links tool call to LLM decision)
   - `tool.type` — category of tool (e.g., 'file_edit', 'shell', 'search', 'browser', 'code_analysis')
   - `tool.input_size_bytes` and `tool.output_size_bytes` — payload sizes for performance analysis
   - `tool.retry_count` — if the tool was retried
   - `tool.parent_agent` — which agent initiated this tool call
   - `tool.status_code` — structured status (success/error/timeout/cancelled)

3. **Add structured error events for tool failures**: When a tool errors, record a proper exception event with `exception.type`, `exception.message`, `exception.stacktrace` (not just a flat string in attributes). Use `tracer.recordEvent()` for this.

4. **Enrich LLM spans with tool-related context**:
   - `llm.tool_calls_count` — how many tools the LLM decided to call
   - `llm.tool_names` — comma-separated list of tools called in this turn
   - `llm.response_preview` — first 500 chars of the LLM text response (for quick scanning)
   - `llm.stop_reason` — why the model stopped (tool_calls, end_turn, max_tokens, etc.)
   - `llm.time_to_first_token_ms` — capture TTFT for streaming responses

5. **Fix the traces API `buildSpanTree()`** in `routes/traces.ts`: Surface the new attributes in the SpanResponse. Add `toolType`, `toolCallId`, `statusCode`, `inputSize`, `outputSize` fields to SpanResponse interface. Update `makePreview()` to generate better previews — for tool input, show the tool name + key argument; for tool output, show a meaningful summary.

6. **Add trace-level summary stats**: In `refreshTraceAggregates()` in TraceService, compute and store: `tool_call_count`, `tool_error_count`, `unique_tools_used` (comma-separated), `avg_tool_duration_ms`. Add these columns to the traces table.

Files to modify:
- `apps/api/src/services/ai/copilot-provider.ts` — tool event handlers and LLM response processing
- `apps/api/src/routes/traces.ts` — buildSpanTree() and SpanResponse interface
- `apps/api/src/services/traces/index.ts` — TraceService aggregation
- `apps/api/src/routes/otlp-collector.ts` — ensure new attributes pass through
- `packages/tracing/src/types.ts` — update ToolSpanAttributes type
- `packages/tracing/src/instrument-tool.ts` — add new attributes to instrumented tool calls

---
**[2026-04-01 11:14:55]** 🚀 Bender started working on this task.
**[2026-04-01 11:14:55]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:23:53]** 🚀 Bender started working on this task.
**[2026-04-01 11:23:53]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:31:36]** 🚀 Bender started working on this task.
**[2026-04-01 11:31:36]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:31:36]** 🚀 Bender started working on this task.
**[2026-04-01 11:31:36]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:31:44]** 🚀 Bender started working on this task.
**[2026-04-01 11:31:44]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:31:44]** 🛑 Permanently blocked after 5 failed attempts.
