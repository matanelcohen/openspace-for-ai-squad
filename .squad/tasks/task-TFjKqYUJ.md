---
id: task-TFjKqYUJ
title: Build trace viewer UI
status: done
priority: P1
assignee: fry
labels:
  - frontend
  - ui
  - observability
  - data-visualization
  - 'parent:task-oJQ0IYQc'
created: '2026-03-25T23:19:09.251Z'
updated: '2026-03-26T00:16:01.786Z'
sortIndex: 142
---
Create a LangSmith-inspired trace viewer with: (1) Trace list page - table showing recent agent runs with columns: agent name, status, duration, total tokens, cost, timestamp. Add filters and search. (2) Trace detail page - waterfall/flame chart visualization showing the span tree (agent → steps → tool calls → LLM calls) with timing bars. Click a span to see its details: input/output, token counts, latency, cost, errors. (3) Stats dashboard - charts for latency distribution, cost over time, token usage trends, error rates. Use existing UI component patterns from the codebase. Ensure the waterfall view clearly shows parent-child span relationships and parallel execution.

---
**[2026-03-26 00:16:01]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-26 00:05:40]** 🧠 Thinking: Let me start by exploring the codebase to understand the existing UI patterns, component library, and project structure before building the trace view
**[2026-03-26 00:05:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:44]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:44]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:44]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:48]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:48]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:48]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:05:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:05]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:20]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:34]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:34]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:34]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:41]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:49]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:49]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:49]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:57]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:57]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:57]** 🔧 Using tool: `unknown`
**[2026-03-26 00:06:57]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:07:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:01]** 🧠 Thinking: Now I have a comprehensive understanding of the codebase. Let me create a plan and then implement the trace viewer. Let me look at a few more specific
**[2026-03-26 00:08:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:01]** ℹ️ /Users/matancohen/.copilot/session-state/7038ca86-9f9c-4546-8928-5e1ebb92807c/plan.md
**[2026-03-26 00:08:07]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:07]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:07]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:07]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:11]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:11]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:08:19]** 🔧 Using tool: `unknown`
**[2026-03-26 00:09:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:09:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:09:13]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/lib/trace-types.ts
**[2026-03-26 00:09:13]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/lib/mock-traces.ts
**[2026-03-26 00:10:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:10:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:10:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:10:01]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/use-traces.ts
**[2026-03-26 00:10:01]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/traces/trace-list.tsx
**[2026-03-26 00:11:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:38]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/traces/trace-stats.tsx
**[2026-03-26 00:11:38]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/traces/trace-detail.tsx
**[2026-03-26 00:11:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:51]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/app/traces/page.tsx
**[2026-03-26 00:11:57]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:57]** 🔧 Using tool: `unknown`
**[2026-03-26 00:11:58]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/app/traces/[traceId]/page.tsx
**[2026-03-26 00:12:06]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:12]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:18]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:25]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:43]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:12:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:07]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:11]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:16]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:23]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:27]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:33]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:42]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:50]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:50]** 🔧 Using tool: `unknown`
**[2026-03-26 00:13:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:02]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:37]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:43]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:14:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:15:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:15:07]** 🔧 Using tool: `unknown`
**[2026-03-26 00:15:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:15:25]** 🔧 Using tool: `unknown`
**[2026-03-26 00:15:25]** 🔧 Using tool: `unknown`
**[2026-03-26 00:15:32]** 🔧 Using tool: `unknown`
**[2026-03-26 00:15:45]** 🔧 Using tool: `unknown`

**[2026-03-26 00:16:01]** ✅ Fry completed this task.

**Result:**
Committed successfully — lint-staged ran eslint and prettier, all passed. Here's a summary:

## ✅ Trace Viewer UI — Complete

Built a LangSmith-inspired trace viewer with **9 new files** (1,764 lines):

### What was created:

1. **Trace List Page** (`/traces`) — Sortable table with agent name, status, duration, tokens, cost, and timestamp columns. Includes search bar + filters for status & agent. Summary stat cards at top.

2. **Trace Detail Page** (`/traces/[traceId]`) — Waterfall visualization showing the span tree (agent → chain → tool/LLM calls) with:
   - Horizontal timing bars scaled to trace duration
   - Color-coded span kinds (purple=agent, blue=chain, amber=tool, green=LLM)
   - Collapsible subtrees showing parent-child relationships
   - Click any span to see detail panel: input/output JSON, token counts, latency, cost, model, errors

3. **Stats Dashboard** — Charts for latency distribution, cost over time, token usage trends (prompt vs completion), error rates by agent, and traces by agent.

4. **Navigation** — Added "Traces" (🔍 Scan icon) to the sidebar between Tasks and Chat.

All files follow existing patterns: shadcn/ui components, React Query hooks, Tailwind CSS, and Next.js app router.
