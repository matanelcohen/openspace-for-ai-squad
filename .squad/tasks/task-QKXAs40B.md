---
id: task-QKXAs40B
title: Enhance trace viewer UI for rich tool visibility
status: pending
priority: P0
assignee: fry
labels:
  - 'parent:task--IVSMCE3'
created: '2026-04-01T11:14:54.342Z'
updated: '2026-04-01T11:37:46.122Z'
sortIndex: 354
parent: task--IVSMCE3
description: "Upgrade the frontend trace viewer to surface all the new trace data with maximum impact. Changes in `apps/web/src/components/traces/`:\n\n1. **Improve WaterfallRow for tool spans** in `trace-detail.tsx`:\n   - Show tool name prominently (not just 'tool') with a colored badge per tool type (file_edit=blue, shell=green, search=purple, browser=orange)\n   - Show input preview inline: e.g., '\U0001F527 edit_file → src/auth.ts' or '\U0001F527 bash → npm run build'\n   - Add a mini status icon (✅/❌/⏱️) and duration in ms right on the row\n   - Show output preview on hover or as a subtitle line\n   - For errored tools, show red background tint and error message preview\n\n2. **Enhance SpanDetail side panel**:\n   - **Input tab**: Render tool input as syntax-highlighted JSON with collapsible sections for large payloads. Show input size badge.\n   - **Output tab**: Same treatment. For large outputs, show truncated with 'Show full output' expander.\n   - **Timeline sub-tab**: Show a mini timeline of this tool's execution within the parent LLM span context\n   - **Error tab** (new): When tool has error, show structured error with type, message, and stack trace in a monospace code block\n\n3. **Add trace summary header** to trace-detail.tsx:\n   - Show total tool calls count, error count, unique tools used as badges\n   - Show total tokens and cost prominently\n   - Show total duration with a breakdown: LLM thinking time vs tool execution time\n   - Show the agent name and task title\n\n4. **Improve trace-list.tsx**:\n   - Add 'Tools' column showing count of tool calls and miniature tool type icons\n   - Add 'Errors' column with red badge if any tool/LLM errors\n   - Add tool names as filterable tags\n\n5. **Add input/output preview tooltips**: When hovering over inputPreview/outputPreview in the waterfall, show a rich tooltip with the first ~500 chars of formatted content.\n\n6. **Color-code the waterfall duration bars** by span kind: tools=blue, LLM=purple, agent=green. This instantly shows where time is spent.\n\nFiles to modify:\n- `apps/web/src/components/traces/trace-detail.tsx` — WaterfallRow, SpanDetail, summary header\n- `apps/web/src/components/traces/trace-list.tsx` — new columns and filters\n- Related type files for the new SpanResponse fields from backend\n\n---\n**[2026-04-01 11:31:36]** \U0001F680 Fry started working on this task.\n**[2026-04-01 11:31:36]** \U0001F39A️ Response tier: **full** — Full squad mobilization (maxAgents: 4)\n\n---\n**[2026-04-01 11:31:36]** \U0001F680 Fry started working on this task.\n**[2026-04-01 11:31:36]** \U0001F39A️ Response tier: **full** — Full squad mobilization (maxAgents: 4)\n\n---\n**[2026-04-01 11:31:44]** \U0001F680 Fry started working on this task.\n**[2026-04-01 11:31:44]** \U0001F39A️ Response tier: **full** — Full squad mobilization (maxAgents: 4)\n\n---\n**[2026-04-01 11:31:44]** \U0001F680 Fry started working on this task.\n**[2026-04-01 11:31:44]** \U0001F39A️ Response tier: **full** — Full squad mobilization (maxAgents: 4)\n\n---\n**[2026-04-01 11:35:20]** \U0001F680 Fry started working on this task.\n**[2026-04-01 11:35:20]** \U0001F39A️ Response tier: **full** — Full squad mobilization (maxAgents: 4)\n\n\n---\n**[2026-04-01 11:37:46]** ⚠️ Task was stuck in-progress after server restart. Reset to pending.\n"
---
Upgrade the frontend trace viewer to surface all the new trace data with maximum impact. Changes in `apps/web/src/components/traces/`:

1. **Improve WaterfallRow for tool spans** in `trace-detail.tsx`:
   - Show tool name prominently (not just 'tool') with a colored badge per tool type (file_edit=blue, shell=green, search=purple, browser=orange)
   - Show input preview inline: e.g., '🔧 edit_file → src/auth.ts' or '🔧 bash → npm run build'
   - Add a mini status icon (✅/❌/⏱️) and duration in ms right on the row
   - Show output preview on hover or as a subtitle line
   - For errored tools, show red background tint and error message preview

2. **Enhance SpanDetail side panel**:
   - **Input tab**: Render tool input as syntax-highlighted JSON with collapsible sections for large payloads. Show input size badge.
   - **Output tab**: Same treatment. For large outputs, show truncated with 'Show full output' expander.
   - **Timeline sub-tab**: Show a mini timeline of this tool's execution within the parent LLM span context
   - **Error tab** (new): When tool has error, show structured error with type, message, and stack trace in a monospace code block

3. **Add trace summary header** to trace-detail.tsx:
   - Show total tool calls count, error count, unique tools used as badges
   - Show total tokens and cost prominently
   - Show total duration with a breakdown: LLM thinking time vs tool execution time
   - Show the agent name and task title

4. **Improve trace-list.tsx**:
   - Add 'Tools' column showing count of tool calls and miniature tool type icons
   - Add 'Errors' column with red badge if any tool/LLM errors
   - Add tool names as filterable tags

5. **Add input/output preview tooltips**: When hovering over inputPreview/outputPreview in the waterfall, show a rich tooltip with the first ~500 chars of formatted content.

6. **Color-code the waterfall duration bars** by span kind: tools=blue, LLM=purple, agent=green. This instantly shows where time is spent.

Files to modify:
- `apps/web/src/components/traces/trace-detail.tsx` — WaterfallRow, SpanDetail, summary header
- `apps/web/src/components/traces/trace-list.tsx` — new columns and filters
- Related type files for the new SpanResponse fields from backend

---
**[2026-04-01 11:31:36]** 🚀 Fry started working on this task.
**[2026-04-01 11:31:36]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:31:36]** 🚀 Fry started working on this task.
**[2026-04-01 11:31:36]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:31:44]** 🚀 Fry started working on this task.
**[2026-04-01 11:31:44]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:31:44]** 🚀 Fry started working on this task.
**[2026-04-01 11:31:44]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-01 11:35:20]** 🚀 Fry started working on this task.
**[2026-04-01 11:35:20]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)
