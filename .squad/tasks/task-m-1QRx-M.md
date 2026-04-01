---
id: task-m-1QRx-M
title: 'Frontend: Display enriched trace data in UI'
status: done
priority: P0
assignee: fry
labels:
  - 'parent:task-0Abr7huJ'
created: '2026-04-01T19:54:42.899Z'
updated: '2026-04-01T20:07:45.425Z'
sortIndex: 378
parent: task-0Abr7huJ
dependsOn:
  - task-P-71a0mt
---
Once the backend provides richer span data, update the frontend trace viewer to display it.

**Changes needed:**

1. **`apps/web/src/lib/trace-types.ts`** — Add new fields to `Span` interface:
   - `temperature: number | null`
   - `maxTokens: number | null`
   - `stopReason: string | null`
   - `messagesCount: number | null`

2. **`apps/web/src/components/traces/trace-detail.tsx`** — Enhance the SpanDetail component:

   **LLM detail section** (after the existing metrics around line 560-598):
   - Add Temperature display (e.g. '0.7') with a thermometer icon
   - Add Max Tokens display
   - Add Stop Reason badge (e.g. 'stop', 'length', 'tool_calls') — use color coding: 'stop'=green, 'length'=yellow, 'tool_calls'=blue
   - Add Messages Count (e.g. '5 messages')

   **Tool detail section** (around line 600-616):
   - Show input/output byte sizes (the `inputBytes`/`outputBytes` fields already exist in the type but may now actually be populated)
   - Add a prominent 'Tool Name' display if `toolName` exists (currently only shown as a small badge)

   **SpanSubtitle component** (line 165-209):
   - For LLM spans: add stop_reason to the subtitle if it's not 'stop' (so truncated responses are visible at a glance)
   - For tool spans: if no inputPreview/outputPreview, show the tool name instead of nothing

   **Waterfall rows** (around line 400-480):
   - For tool spans with errors, show a red text snippet of the error in the subtitle
   - For LLM spans, add a small messages count badge next to the token badge (e.g. '5 msgs')

3. **Input/Output tabs** (around line 696+):
   - When input or output is a string (not JSON), render it as plain text with word wrap instead of trying to syntax-highlight it as JSON
   - Add a 'Raw' / 'Formatted' toggle for switching between pretty-printed and raw views

Run `pnpm build` in `apps/web` to verify. Check the trace detail page manually if possible.

---
**[2026-04-01 20:07:45]** 🚀 Fry started working on this task.

**Progress:**
**[2026-04-01 20:01:13]** 🧠 Thinking: Let me analyze this task. I need to update the frontend trace viewer to display enriched trace data. Let me start by exploring the codebase to understand the current structure, then make the changes.

Let me explore the relevant files first.
**[2026-04-01 20:01:13]** 🔧 Using tool: `report_intent` — {"intent":"Exploring trace viewer codebase"}
**[2026-04-01 20:01:13]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/lib/trace-types.ts
**[2026-04-01 20:01:13]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:01:13]** 🔧 Using tool: `bash` — `ls /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/node_modules/.package-lock.json 2>/dev/null && echo "DEPS_EXIST" || echo "NO_DEPS"`
**[2026-04-01 20:01:13]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:13]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:13]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:14]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:20]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:01:20]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:01:20]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:01:20]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:01:20]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:01:20]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:20]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:20]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:20]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:20]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:28]** 🧠 Thinking: Let me continue viewing the remaining parts of the file to understand the full structure.
**[2026-04-01 20:01:28]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:01:28]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:01:28]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:01:28]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:01:28]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:28]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:28]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:29]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:44]** 🧠 Thinking: Now I have a complete picture of the file. Let me now implement all the changes. Let me plan:

1. **`apps/web/src/lib/trace-types.ts`** — Add new fields to `Span` interface:
   - `temperature: number | null`
   - `maxTokens: number | null`
   - `stopReason: string | null`
   - `messagesCount: number | null`

2. **`apps/web/src/components/traces/trace-detail.tsx`** — Multiple changes:

   a. **Imports**: Add `Thermometer`, `MessageSquare`, `Hash`, `ToggleLeft`/`ToggleRight` icons
   
   b. **SpanSubtitle** — Update to show stop_reason for LLM spans when it's not 'stop', and display toolName for tool spans lacking input/output previews.
   
   c. **Waterfall rows** — Add error snippets in red for tool spans and a messages count badge alongside the token badge for LLM spans.
   
   d. **LLM detail section** — Add temperature with a thermometer icon, max tokens display, and a stop reason badge.
**[2026-04-01 20:01:44]** 🔧 Using tool: `report_intent` — {"intent":"Implementing enriched trace UI"}
**[2026-04-01 20:01:44]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug && pnpm install --frozen-lockfile 2>&1 | tail -5`
**[2026-04-01 20:01:44]** ✅ Tool result: [object Object]
**[2026-04-01 20:01:55]** ✅ Tool result: [object Object]
**[2026-04-01 20:02:06]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/lib/trace-types.ts
**[2026-04-01 20:02:06]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:02:06]** ✅ Tool result: [object Object]
**[2026-04-01 20:02:06]** ✅ Tool result: [object Object]
**[2026-04-01 20:02:17]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:02:17]** ✅ Tool result: [object Object]
**[2026-04-01 20:02:26]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:02:26]** ✅ Tool result: [object Object]
**[2026-04-01 20:02:30]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:02:30]** ✅ Tool result: [object Object]
**[2026-04-01 20:02:35]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:02:35]** ✅ Tool result: [object Object]
**[2026-04-01 20:02:47]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:02:47]** ✅ Tool result: [object Object]
**[2026-04-01 20:02:57]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:02:57]** ✅ Tool result: [object Object]
**[2026-04-01 20:03:02]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:03:02]** ✅ Tool result: [object Object]
**[2026-04-01 20:03:08]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:03:08]** ✅ Tool result: [object Object]
**[2026-04-01 20:03:12]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:03:12]** ✅ Tool result: [object Object]
**[2026-04-01 20:03:16]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:03:16]** ✅ Tool result: [object Object]
**[2026-04-01 20:03:35]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 20:03:35]** ✅ Tool result: [object Object]
**[2026-04-01 20:03:39]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug && pnpm --filter web build 2>&1 | tail -30`
**[2026-04-01 20:03:40]** ✅ Tool result: [object Object]
**[2026-04-01 20:03:45]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug && cat apps/web/package.json | head -5 && cat pnpm-workspace.yaml`
**[2026-04-01 20:03:45]** ✅ Tool result: [object Object]
**[2026-04-01 20:03:49]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web && pnpm build 2>&1 | tail -30`
**[2026-04-01 20:04:23]** ✅ Tool result: [object Object]
**[2026-04-01 20:04:26]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/lib/mock-traces.ts
**[2026-04-01 20:04:27]** ✅ Tool result: [object Object]
**[2026-04-01 20:04:33]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/lib/mock-traces.ts
**[2026-04-01 20:04:33]** ✅ Tool result: [object Object]
**[2026-04-01 20:04:37]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web && pnpm build 2>&1 | tail -30`
**[2026-04-01 20:04:53]** ✅ Tool result: [object Object]
**[2026-04-01 20:05:07]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/lib/mock-traces.ts
**[2026-04-01 20:05:07]** ✅ Tool result: [object Object]
**[2026-04-01 20:05:11]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web && pnpm build 2>&1 | tail -30`
**[2026-04-01 20:05:29]** ✅ Tool result: [object Object]
**[2026-04-01 20:05:33]** 🔧 Using tool: `view` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/lib/mock-traces.ts
**[2026-04-01 20:05:33]** ✅ Tool result: [object Object]
**[2026-04-01 20:05:37]** 🔧 Using tool: `edit` — /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web/src/lib/mock-traces.ts
**[2026-04-01 20:05:37]** ✅ Tool result: [object Object]
**[2026-04-01 20:05:40]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug/apps/web && pnpm build 2>&1 | tail -20`
**[2026-04-01 20:06:02]** ✅ Tool result: [object Object]
**[2026-04-01 20:06:05]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug && pnpm vitest run 2>&1 | tail -20`
**[2026-04-01 20:06:32]** ✅ Tool result: [object Object]
**[2026-04-01 20:06:37]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug && pnpm vitest run 2>&1 | grep -E "FAIL.*trace" -i`
**[2026-04-01 20:07:07]** ✅ Tool result: [object Object]
**[2026-04-01 20:07:11]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug && pnpm vitest run apps/web/src/components/traces/__tests__/trace-detail.test.tsx 2>&1 | tail -50`
**[2026-04-01 20:07:13]** ✅ Tool result: [object Object]
**[2026-04-01 20:07:18]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug && pnpm vitest run e2e/trace-enrichment-smoke.spec.ts 2>&1 | tail -30`
**[2026-04-01 20:07:20]** ✅ Tool result: [object Object]
**[2026-04-01 20:07:25]** 🔧 Using tool: `bash` — `cd /private/tmp/openspace-task-m-1QRx-M--81625-eOlVA9QVpLug && git --no-pager diff --stat`
**[2026-04-01 20:07:25]** ✅ Tool result: [object Object]
**Branch:** `task/task-m-1QRx-M`

**[2026-04-01 20:07:45]** ✅ Fry completed this task.

**Result:**
Build passes ✅. Here's a summary of what I did:

### Changes Made

**1. `apps/web/src/lib/trace-types.ts`** — Added 4 new fields to `Span` interface:
- `temperature`, `maxTokens`, `stopReason`, `messagesCount`

**2. `apps/web/src/components/traces/trace-detail.tsx`** — Enhanced trace viewer:
- **SpanSubtitle**: LLM spans show `⚠ stopReason` when not `'stop'`; tool spans show `toolName` as fallback
- **Waterfall rows**: LLM spans get a messages count badge (`5 msgs`); tool spans with errors show red error snippet
- **LLM detail section**: Temperature (🌡️), Max Tokens, Stop Reason (color-coded badge: green/yellow/blue), Messages Count
- **Tool detail section**: Prominent Tool Name display with icon, plus byte sizes
- **Input/Output tabs**: String content renders as plain text with word-wrap; Raw/Formatted toggle for JSON views

**3. `apps/web/src/lib/mock-traces.ts`** — Added mock data for all 4 new fields so dev previews work.
