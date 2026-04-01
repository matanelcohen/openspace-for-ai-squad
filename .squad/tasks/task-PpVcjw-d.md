---
id: task-PpVcjw-d
title: Build rich trace detail UI
status: in-progress
priority: P0
assignee: fry
labels:
  - 'parent:task-T3rsv-au'
created: '2026-04-01T16:45:44.411Z'
updated: '2026-04-01T16:56:09.325Z'
sortIndex: 366
parent: task-T3rsv-au
dependsOn:
  - task-pjGTO5AR
---
Redesign the trace detail view in `apps/web/src/components/traces/` for maximum visibility:

1. **Tool spans** — Show collapsible input/output sections with syntax-highlighted JSON. Display tool name prominently as a badge. Show duration, status icon (✅/❌), and payload size.
2. **LLM spans** — Show model name as badge, token counts (prompt/completion/total), cost in USD, latency, and collapsible prompt/response previews with syntax highlighting.
3. **Waterfall timeline improvements** — Color-code spans by kind (tool=blue, llm=purple, agent=green, internal=gray). Show duration bars proportional to time. Add hover tooltips with key attributes.
4. **Trace summary header** — At the top of trace detail, show: total duration, total cost, total tokens, number of tool calls, number of LLM calls, success/error status, and the agent/task name.
5. **Search & filter** — Add ability to filter spans by kind (tool/llm/agent), search by tool name or content within input/output.
6. **Copy buttons** — Add copy-to-clipboard for input/output JSON payloads.
7. **Error highlighting** — Failed spans should be visually distinct (red border/background) with error message prominently displayed.
8. **Trace list improvements** — In `trace-list.tsx`, show preview columns: total cost, total tokens, duration, number of steps, and status badge.

---
**[2026-04-01 16:56:09]** 🚀 Fry started working on this task.
**[2026-04-01 16:56:09]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)
