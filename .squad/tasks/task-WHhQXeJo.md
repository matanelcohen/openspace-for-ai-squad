---
id: task-WHhQXeJo
title: Overhaul trace viewer UI for tool visibility
status: in-progress
priority: P0
assignee: fry
labels:
  - 'parent:task-AhF7rCH-'
created: '2026-04-01T15:13:48.012Z'
updated: '2026-04-01T15:24:48.899Z'
sortIndex: 362
parent: task-AhF7rCH-
dependsOn:
  - task-5K-FQyO5
---
The trace viewer exists but tool input/output aren't prominent enough. Major UI enhancements:

1. **Waterfall view enhancements** (`apps/web/src/components/traces/trace-detail.tsx`):
   - Show tool input/output INLINE in the waterfall rows (not just in detail panel) — add expandable preview cards showing first 3 lines of input and first 3 lines of output directly in each tool span row
   - Add color-coded status indicators: green=success, red=error, yellow=running, with error count badges
   - Show tool duration prominently as a bar width proportional to total trace time
   - Add copy-to-clipboard buttons for tool input and output JSON
   - Add syntax-highlighted JSON viewer (use a code block with proper formatting) for the Input and Output tabs in the detail panel — currently it may just be raw text
   - Show input/output byte sizes as badges (e.g., '2.3 KB input → 156 B output')

2. **New Tool Analytics Dashboard** — add a new tab/section in `apps/web/src/components/traces/trace-stats.tsx`:
   - 'Tool Breakdown' chart: horizontal bar chart showing call count per tool
   - 'Slowest Tools' table: tool name, avg duration, p95 duration, call count
   - 'Tool Error Rate' chart: error percentage per tool
   - 'Tool Timeline' view: Gantt-chart style showing tool execution parallelism within a trace

3. **Trace list enhancements** (`apps/web/src/components/traces/trace-list.tsx`):
   - Add tool count badge per trace in list view (e.g., '🔧 5 tools')
   - Add quick-peek tooltip on hover showing tools used in that trace
   - Add filter-by-tool-name dropdown

4. **Error experience**: When a tool errors, show the error message prominently with a red banner in the waterfall, not hidden in a tab. Show the stack trace in a collapsible section.

5. **LLM span enhancements**: Show model name, token breakdown (prompt vs completion), cost, and stop reason prominently in LLM span rows.

Key files: `apps/web/src/components/traces/trace-detail.tsx`, `apps/web/src/components/traces/trace-list.tsx`, `apps/web/src/components/traces/trace-stats.tsx`, `apps/web/src/lib/trace-types.ts`, `apps/web/src/hooks/use-traces.ts`

---
**[2026-04-01 15:24:48]** 🚀 Fry started working on this task.
**[2026-04-01 15:24:48]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)
