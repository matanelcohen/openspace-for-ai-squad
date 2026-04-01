---
id: task-z34gSbMN
title: Upgrade trace viewer UI for rich visibility
status: done
priority: P0
assignee: fry
labels:
  - 'parent:task-usEDtuGg'
created: '2026-04-01T17:08:39.948Z'
updated: '2026-04-01T17:31:19.477Z'
sortIndex: 370
parent: task-usEDtuGg
dependsOn:
  - task-Cuagw3sA
---
Overhaul the frontend trace viewer to prominently display tool names, inputs, outputs, and other enriched span data. The goal is 'amazing visibility with a lot of impact.'

1. **Span list improvements** in `apps/web/` trace components:
   - Show `toolName` as a prominent badge/pill on each tool span row (not just 'tool')
   - Show `inputPreview` and `outputPreview` inline in the span list (collapsible, first ~100 chars)
   - Color-code span types: tool=blue, llm=purple, agent=green, error=red
   - Show duration as a visual bar proportional to total trace duration
   - Add token count and cost badges on LLM spans
   - Show model name on LLM spans

2. **Span detail improvements** in `trace-detail.tsx`:
   - Input/Output panels: use syntax-highlighted JSON viewer (collapsible for large payloads)
   - Add a 'Copy' button for input/output JSON
   - Show input/output size (bytes) and type
   - For error spans: show error message prominently in red with expandable stack trace
   - Show parent span name for context ('Called by: AgentLoop')

3. **Waterfall/timeline enhancements:**
   - Add span labels on the waterfall bars (tool name + duration)
   - Hover tooltip showing: tool name, input preview, output preview, duration, status
   - Click to expand full details inline

4. **Quick summary header** at top of trace detail:
   - Total duration, total cost, total tokens, span count, error count
   - List of unique tools used in this trace
   - Visual status indicator (all green / has errors)

Update `apps/web/src/lib/trace-types.ts` to match any new fields from the API.

---
**[2026-04-01 17:31:19]** 🚀 Fry started working on this task.

**Progress:**
**[2026-04-01 17:25:13]** 🧠 Thinking: Let me start by understanding the codebase structure, particularly the trace viewer components in `apps/web/`. I need to explore the existing code before making changes.
**[2026-04-01 17:25:13]** 🔧 Using tool: `report_intent` — {"intent":"Exploring trace viewer codebase"}
**[2026-04-01 17:25:13]** 🔧 Using tool: `task` — {"agent_type":"explore","description":"Explore trace viewer structure","mode":"background","name":"explore-trace-viewer","prompt":"I need to understand the trace viewer UI in this monorepo. Please find and analyze ALL of the following:\n\n1. Find all trace-related files under `apps/web/` - look for files with \"trace\" in their name or path\n2. Read the full contents of `apps/web/src/lib/trace-types.ts` \n3. Find and read all trace component files (trace-detail, trace-list, trace-viewer, waterfall/timeline components, etc.)\n4. Find what UI framework/component library is used (check package.json in apps/web/)\n5. Look for any existing color theming, badge components, or design system utilities\n6. Check if there's a JSON viewer or syntax highlighting library already in use\n7. Find any CSS/styling files related to traces\n\nPlease provide the FULL content of each trace-related file you find, especially:\n- trace-types.ts\n- Any trace detail component\n- Any trace list/span list component  \n- Any waterfall/timeline component\n- The apps/web/package.json (dependencies section)\n\nBe thorough - I need to see the actual code to understand what exists before making changes."}
**[2026-04-01 17:25:13]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:13]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:16]** 🔧 Using tool: `read_agent` — {"agent_id":"explore-trace-viewer-2","timeout":60,"wait":true}
**[2026-04-01 17:25:17]** 🔧 Using tool: `glob` — {"pattern":"**/apps/web/**/*trace*"}
**[2026-04-01 17:25:17]** 🔧 Using tool: `glob` — {"pattern":"**/apps/web/src/components/**/*"}
**[2026-04-01 17:25:17]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web
**[2026-04-01 17:25:17]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/package.json
**[2026-04-01 17:25:18]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:18]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:18]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:33]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:39]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/lib/trace-types.ts
**[2026-04-01 17:25:39]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/lib/mock-traces.ts
**[2026-04-01 17:25:39]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:25:39]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-list.tsx
**[2026-04-01 17:25:39]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-stats.tsx
**[2026-04-01 17:25:39]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/hooks/use-traces.ts
**[2026-04-01 17:25:39]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/ui/badge.tsx
**[2026-04-01 17:25:39]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:39]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:40]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:40]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:40]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:40]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:40]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:44]** 🔧 Using tool: `bash` — `wc -l /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx`
**[2026-04-01 17:25:44]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:25:44]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:45]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:49]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:25:49]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:25:49]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:25:49]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:49]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:49]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:53]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:25:53]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:25:53]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:54]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:57]** 🔧 Using tool: `bash` — `find /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web -name "*.css" -o -name "*tailwind*" -o -name "*theme*" | head -20`
**[2026-04-01 17:25:57]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/tailwind.config.ts
**[2026-04-01 17:25:57]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/lib
**[2026-04-01 17:25:57]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:57]** ✅ Tool result: [object Object]
**[2026-04-01 17:25:58]** ✅ Tool result: [object Object]
**[2026-04-01 17:26:02]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/app/globals.css
**[2026-04-01 17:26:02]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/lib/utils.ts
**[2026-04-01 17:26:02]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/ui/card.tsx
**[2026-04-01 17:26:02]** ✅ Tool result: [object Object]
**[2026-04-01 17:26:02]** ✅ Tool result: [object Object]
**[2026-04-01 17:26:02]** ✅ Tool result: [object Object]
**[2026-04-01 17:26:05]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/__tests__/trace-detail.test.tsx
**[2026-04-01 17:26:05]** ✅ Tool result: [object Object]
**[2026-04-01 17:26:14]** 🔧 Using tool: `bash` — `grep -r "react-syntax-highlighter\|json\|chart\|graph" /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/package.json`
**[2026-04-01 17:26:15]** ✅ Tool result: [object Object]
**[2026-04-01 17:26:16]** ✅ Tool result: [object Object]
**[2026-04-01 17:26:19]** 🔧 Using tool: `read_agent` — {"agent_id":"explore-trace-viewer-2","timeout":60,"wait":true}
**[2026-04-01 17:26:48]** ✅ Tool result: [object Object]
**[2026-04-01 17:26:57]** 🧠 Thinking: Now I have a comprehensive understanding of the trace viewer. Let me read the actual files to see the current implementation, then plan my changes. Let me read the key files directly to see the exact code.
**[2026-04-01 17:26:57]** 🔧 Using tool: `report_intent` — {"intent":"Reading trace source files"}
**[2026-04-01 17:26:57]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:26:57]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-list.tsx
**[2026-04-01 17:26:57]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/lib/trace-types.ts
**[2026-04-01 17:26:57]** ✅ Tool result: [object Object]
**[2026-04-01 17:26:57]** ✅ Tool result: [object Object]
**[2026-04-01 17:26:57]** ✅ Tool result: [object Object]
**[2026-04-01 17:26:57]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:06]** 🧠 Thinking: Now let me read the trace-detail.tsx in chunks since it's too large.
**[2026-04-01 17:27:06]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:27:06]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:27:06]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:27:06]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:27:06]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/trace-detail.tsx
**[2026-04-01 17:27:06]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:06]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:06]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:06]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:06]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:16]** 🧠 Thinking: Now I have the full picture of the codebase. Let me also check for the test file and build/test setup.
**[2026-04-01 17:27:16]** 🔧 Using tool: `report_intent` — {"intent":"Checking tests and build setup"}
**[2026-04-01 17:27:16]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/traces/__tests__/trace-detail.test.tsx
**[2026-04-01 17:27:16]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN && cat apps/web/package.json | head -60`
**[2026-04-01 17:27:16]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN && cat package.json | head -30`
**[2026-04-01 17:27:16]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN && ls node_modules/.package-lock.json 2>/dev/null || echo "no node_modules" && ls apps/web/node_modules/.package-lock.json 2>/dev/null || echo "no apps/web/node_modules"`
**[2026-04-01 17:27:16]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:16]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:16]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:16]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:17]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:24]** 🧠 Thinking: I need to install dependencies first. Let me also look at the mock-traces.ts to understand the data shape, and check the Tooltip component since I'll need it for waterfall hover tooltips.
**[2026-04-01 17:27:24]** 🔧 Using tool: `report_intent` — {"intent":"Installing dependencies"}
**[2026-04-01 17:27:25]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN && pnpm install --frozen-lockfile 2>&1 | tail -5`
**[2026-04-01 17:27:25]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN && find apps/web/src/components/ui -name "tooltip*" -o -name "collapsible*" | head -5`
**[2026-04-01 17:27:25]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/lib/mock-traces.ts
**[2026-04-01 17:27:25]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:25]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:25]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:38]** ✅ Tool result: [object Object]
**[2026-04-01 17:27:44]** 🧠 Thinking: Now I have a complete understanding. Let me check the tooltip component to be sure I can use it:
**[2026-04-01 17:27:44]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-z34gSbMN/apps/web/src/components/ui/tooltip.tsx
**[2026-04-01 17:27:44]** ✅ Tool result: [object Object]
**Branch:** `task/task-z34gSbMN`

**[2026-04-01 17:31:19]** ✅ Fry completed this task.

**Result:**
