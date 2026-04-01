---
id: task-M-qLQyLi
title: Redesign trace detail UI for rich span visibility
status: blocked
priority: P0
assignee: fry
labels:
  - 'parent:task-DEDTW7M7'
created: '2026-04-01T09:31:26.815Z'
updated: '2026-04-01T09:36:17.273Z'
sortIndex: 350
parent: task-DEDTW7M7
dependsOn:
  - task-np7Ihbqf
---
Overhaul the trace detail frontend in `apps/web/src/components/traces/trace-detail.tsx` to surface the enriched data from the backend. This is a P0 visibility improvement. Key changes:

1. **Show tool name in waterfall rows** (line ~204): Instead of just `span.name`, show the `toolName` prominently in the span row with a pill/badge. For tool spans, display format: `toolName` with the tool icon, not just 'tool:toolName' as plain text.
2. **Better input/output rendering** (lines 342-348): Replace the raw `JSON.stringify` with a proper JSON viewer component that has:
   - Syntax highlighting (color-code keys, strings, numbers, booleans)
   - Collapsible nested objects/arrays
   - Copy-to-clipboard button
   - 'No input captured' / 'No output captured' empty states with helpful message instead of null/undefined
   - Truncation for large payloads with 'Show more' toggle
3. **Add Events tab**: Add a 4th tab 'Events' next to Input/Output/Metadata showing the span events timeline — each event with timestamp, name, and attributes. Use a mini-timeline/list format.
4. **Tool info summary card**: For tool spans, show a summary card above the tabs with: Tool Name, Tool ID, Execution Duration, Input Size, Output Size, Status — all at a glance without needing to click into tabs.
5. **LLM info summary card**: For LLM spans, show: Model, Tokens/sec, Message Count, Response Length alongside existing token/cost metrics.
6. **Span row improvements**: In the waterfall view, add a subtle preview of key info on hover — tool name for tool spans, model name for LLM spans, error message preview for error spans.
7. **Better error display**: When a span has an error, show it in a red-bordered callout box with the full error message and stack trace (if in events), not just a tiny red text snippet.

Files to modify:
- `apps/web/src/components/traces/trace-detail.tsx` — main component
- Consider creating `apps/web/src/components/traces/json-viewer.tsx` for the reusable JSON viewer
- `apps/web/src/components/traces/trace-list.tsx` — update list to show tool names in trace summaries if applicable

---
**[2026-04-01 09:36:17]** ❌ **BLOCKED** — fry failed.

**Error:** Missing required field "id" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-M-qLQyLi.md

**Stack:** ```
Error: Missing required field "id" in /Users/matancohen/microsoft/openspace-for-ai-squad/.squad/tasks/task-M-qLQyLi.md
    at parseTaskFile (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/squad-parser/task-parser.ts:79:11)
    at getTask (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/squad-writer/task-writer.ts:219:10)
    at async AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-wo
```
