---
id: task-hrViAwMc
title: Persist kanban filter state in URL search params
status: done
priority: P2
assignee: fry
labels:
  - feature
  - ux
  - kanban
  - filters
  - 'parent:task-XGIIS5pk'
created: '2026-03-31T13:01:34.357Z'
updated: '2026-03-31T21:00:51.388Z'
sortIndex: 328
---
Persist the active kanban filters (status, priority, assignee, search) in URL query parameters so filters survive page refreshes and can be shared via URL. Use Next.js `useSearchParams` + `useRouter` to sync filter state with the URL. Initialize filters from URL params on mount. This ensures a consistent UX with the list view and supports bookmarkable filtered views.

---
**[2026-03-31 21:00:51]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-31 20:54:27]** 🧠 Thinking: Let me understand the task: I need to persist kanban filter state (status, priority, assignee, search) in URL search params so they survive page refreshes and can be shared. I need to use Next.js `useSearchParams` + `useRouter` to sync filter state with the URL.

Let me start by exploring the codebase to understand the current kanban implementation and how filtering works.
**[2026-03-31 20:54:27]** 🔧 Using tool: `report_intent` — {"intent":"Exploring kanban codebase"}
**[2026-03-31 20:54:27]** 🔧 Using tool: `task` — {"agent_type":"explore","description":"Explore kanban filter code","mode":"background","name":"explore-kanban","prompt":"Explore the codebase to understand the kanban board implementation and its filter system. I need to find:\n\n1. Where the kanban board component lives (look in apps/ and packages/ directories)\n2. How filters (status, priority, assignee, search) are currently managed in the kanban view\n3. How the list view already persists filters in URL params (the task mentions \"consistent UX with the list view\")\n4. What Next.js routing patterns are used (App Router vs Pages Router, useSearchParams usage)\n5. Any existing hooks or utilities for URL param management\n\nSearch broadly:\n- glob for files with \"kanban\" in the name\n- glob for files with \"filter\" in the name  \n- grep for \"useSearchParams\" usage\n- grep for \"kanban\" in component files\n- Look at the project structure under apps/ and packages/\n\nProvide the full file paths and relevant code snippets for all findings."}
**[2026-03-31 20:54:32]** 🔧 Using tool: `glob` — {"pattern":"**/*kanban*"}
**[2026-03-31 20:54:32]** 🔧 Using tool: `glob` — {"pattern":"**/*filter*"}
**[2026-03-31 20:54:32]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc
**[2026-03-31 20:54:32]** 🔧 Using tool: `bash` — `find /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc -maxdepth 3 -type d -name "apps" -o -name "packages" | head -20`
**[2026-03-31 20:54:32]** 🔧 Using tool: `read_agent` — {"agent_id":"explore-kanban-2","timeout":60,"wait":true}
**[2026-03-31 20:54:36]** 🔧 Using tool: `grep` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc
**[2026-03-31 20:54:36]** 🔧 Using tool: `grep` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc
**[2026-03-31 20:54:36]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/kanban-board.tsx
**[2026-03-31 20:54:36]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/kanban-column.tsx
**[2026-03-31 20:54:41]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/task-filters-toolbar.tsx
**[2026-03-31 20:54:41]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/lib/task-filters.ts
**[2026-03-31 20:54:41]** 🔧 Using tool: `glob` — {"pattern":"**/tasks/*view* "}
**[2026-03-31 20:54:41]** 🔧 Using tool: `glob` — {"pattern":"**/tasks/*list*"}
**[2026-03-31 20:54:45]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/task-list-view.tsx
**[2026-03-31 20:54:45]** 🔧 Using tool: `bash` — `find /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web -path "*tasks*page*" -type f`
**[2026-03-31 20:54:45]** 🔧 Using tool: `grep` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc
**[2026-03-31 20:54:48]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/app/tasks/page.tsx
**[2026-03-31 20:54:48]** 🔧 Using tool: `bash` — `ls -la /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/app/ | head -20`
**[2026-03-31 20:54:48]** 🔧 Using tool: `bash` — `grep -r "use 'use client'" /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/app/ 2>/dev/null | head -5`
**[2026-03-31 20:54:53]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/app/workflows/page.tsx
**[2026-03-31 20:54:53]** 🔧 Using tool: `bash` — `grep -r "searchParams" /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web --include="*.tsx" --include="*.ts" | head -20`
**[2026-03-31 20:54:53]** 🔧 Using tool: `bash` — `find /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/lib -type f -name "*url*" -o -name "*param*" -o -name "*query*"`
**[2026-03-31 20:54:57]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/app/workflows/[id]/page.tsx
**[2026-03-31 20:54:57]** 🔧 Using tool: `bash` — `grep -r "useRouter" /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks --include="*.tsx" | head -10`
**[2026-03-31 20:54:57]** 🔧 Using tool: `bash` — `find /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web -name "layout.tsx" | head -3 | xargs head -20`
**[2026-03-31 20:55:02]** 🔧 Using tool: `bash` — `ls -la /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/packages/`
**[2026-03-31 20:55:02]** 🔧 Using tool: `bash` — `find /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/lib -type f -name "*.ts" | head -20`
**[2026-03-31 20:55:06]** 🔧 Using tool: `bash` — `grep -r "URLSearchParams\|query-string\|qs" /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web --include="*.tsx" --include="*.ts" --include="*.json" | head -20`
**[2026-03-31 20:55:06]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/lib/utils.ts
**[2026-03-31 20:55:11]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/chat/channel-sidebar.tsx
**[2026-03-31 20:55:11]** 🔧 Using tool: `bash` — `grep -A 10 "useSearchParams" /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/chat/channel-sidebar.tsx | head -20`
**[2026-03-31 20:55:14]** 🔧 Using tool: `bash` — `grep -A 50 "\"dependencies\"" /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/package.json | head -60`
**[2026-03-31 20:55:14]** 🔧 Using tool: `bash` — `grep "next" /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/package.json`
**[2026-03-31 20:55:18]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/hooks
**[2026-03-31 20:55:18]** 🔧 Using tool: `bash` — `head -40 /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/hooks/use-tasks.ts`
**[2026-03-31 20:55:36]** 🔧 Using tool: `read_agent` — {"agent_id":"explore-kanban-2","timeout":60,"wait":true}
**[2026-03-31 20:55:47]** 🧠 Thinking: Great, I have a comprehensive understanding of the codebase. Now let me read the key files I need to modify and implement the URL param persistence for the kanban board filters.

Let me read the key files first, then implement the changes.
**[2026-03-31 20:55:47]** 🔧 Using tool: `report_intent` — {"intent":"Reading kanban source files"}
**[2026-03-31 20:55:47]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/kanban-board.tsx
**[2026-03-31 20:55:47]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/task-filters-toolbar.tsx
**[2026-03-31 20:55:47]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/lib/task-filters.ts
**[2026-03-31 20:55:47]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/app/tasks/page.tsx
**[2026-03-31 20:55:55]** 🧠 Thinking: Now I have a clear picture. Let me also check the task-list-view.tsx to see its filter implementation for consistency:
**[2026-03-31 20:55:55]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/task-list-view.tsx
**[2026-03-31 20:55:55]** 🔧 Using tool: `glob` — {"pattern":"**/*kanban*test*"}
**[2026-03-31 20:55:55]** 🔧 Using tool: `glob` — {"pattern":"**/*kanban*.spec*"}
**[2026-03-31 20:55:55]** 🔧 Using tool: `glob` — {"pattern":"**/*task-filter*.test*"}
**[2026-03-31 20:55:59]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/__tests__/kanban-board.test.tsx
**[2026-03-31 20:55:59]** 🔧 Using tool: `glob` — {"pattern":"apps/web/src/components/tasks/__tests__/*"}
**[2026-03-31 20:56:11]** 🧠 Thinking: Now I have a complete picture. Let me create a `useTaskFilters` hook that:
1. Reads initial filter state from URL search params
2. Syncs filter changes back to URL
3. Can be used by both KanbanBoard and TaskListView for consistency

The approach:
1. Create a new hook `useTaskFilterParams` in `apps/web/src/hooks/use-task-filter-params.ts`
2. Update `kanban-board.tsx` to use the hook instead of local state
3. Update `task-list-view.tsx` similarly for consistency
4. Update tests to mock `useSearchParams` and `useRouter`


5. I should check if there's already a mocking pattern for `next/navigation` in the existing test suite to keep things consistent.
**[2026-03-31 20:56:11]** 🔧 Using tool: `report_intent` — {"intent":"Implementing URL filter persistence"}
**[2026-03-31 20:56:11]** 🔧 Using tool: `grep` — apps/web/src/components/tasks/__tests__
**[2026-03-31 20:56:11]** 🔧 Using tool: `grep` — apps/web
**[2026-03-31 20:56:11]** 🔧 Using tool: `bash` — `ls apps/web/node_modules/.package-lock.json 2>/dev/null || ls apps/web/node_modules 2>/dev/null | head -5 || echo "no node_modules"`
**[2026-03-31 20:56:18]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/__tests__/task-detail-page.test.tsx
**[2026-03-31 20:56:18]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && ls node_modules/.package-lock.json 2>/dev/null && echo "root has modules" || echo "checking apps/web"; ls apps/web/node_modules 2>/dev/null | head -3 || echo "no web modules either"`
**[2026-03-31 20:56:24]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && pnpm install --frozen-lockfile 2>&1 | tail -5`
**[2026-03-31 20:56:51]** 🔧 Using tool: `create` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/hooks/use-task-filter-params.ts
**[2026-03-31 20:56:51]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/hooks/use-task-filter-params.ts
**[2026-03-31 20:56:59]** 🔧 Using tool: `edit` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/kanban-board.tsx
**[2026-03-31 20:57:03]** 🔧 Using tool: `edit` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/kanban-board.tsx
**[2026-03-31 20:57:33]** 🔧 Using tool: `edit` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/task-list-view.tsx
**[2026-03-31 20:57:38]** 🔧 Using tool: `edit` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/task-list-view.tsx
**[2026-03-31 20:57:45]** 🔧 Using tool: `edit` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/__tests__/kanban-board.test.tsx
**[2026-03-31 20:57:49]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/__tests__/task-list-view.test.tsx
**[2026-03-31 20:57:53]** 🔧 Using tool: `edit` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/__tests__/task-list-view.test.tsx
**[2026-03-31 20:57:59]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/__tests__/tasks-page.test.tsx
**[2026-03-31 20:58:04]** 🔧 Using tool: `edit` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/__tests__/tasks-page.test.tsx
**[2026-03-31 20:58:10]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && pnpm vitest run apps/web/src/components/tasks/__tests__/ --reporter=verbose 2>&1 | tail -60`
**[2026-03-31 20:58:19]** 🧠 Thinking: The test failures are pre-existing - they're failing because of module resolution issues (`ERR_MODULE_NOT_FOUND` for `@/components/tasks/task-list-view`, `@/hooks/use-agents`, etc.). These are unrelated to my changes. Let me check if these tests were already failing before my changes. Let me also check if there's a specific test configuration.
**[2026-03-31 20:58:19]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && git stash && pnpm vitest run apps/web/src/components/tasks/__tests__/kanban-board.test.tsx 2>&1 | tail -15`
**[2026-03-31 20:58:25]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && git stash pop`
**[2026-03-31 20:58:29]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | tail -30`
**[2026-03-31 20:58:44]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -E "(kanban-board|task-list-view|use-task-filter-params|task-filters-toolbar)" || echo "No errors in changed files"`
**[2026-03-31 20:58:52]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/kanban-board.tsx
**[2026-03-31 20:58:56]** 🔧 Using tool: `edit` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/kanban-board.tsx
**[2026-03-31 20:59:01]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && npx tsc --noEmit -p apps/web/tsconfig.json 2>&1 | grep -E "(kanban-board\.tsx|task-list-view\.tsx|use-task-filter-params)" || echo "No errors in source files"`
**[2026-03-31 20:59:09]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && pnpm --filter @openspace/web build 2>&1 | tail -20`
**[2026-03-31 20:59:14]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && cat apps/web/package.json | grep -E '"name"|"build"'`
**[2026-03-31 20:59:20]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && pnpm --filter "@matanelcohen/openspace-web" build 2>&1 | tail -30`
**[2026-03-31 20:59:52]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && git stash && pnpm --filter "@matanelcohen/openspace-web" build 2>&1 | tail -10`
**[2026-03-31 21:00:14]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && git stash pop`
**[2026-03-31 21:00:19]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/hooks/use-task-filter-params.ts
**[2026-03-31 21:00:19]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/kanban-board.tsx
**[2026-03-31 21:00:19]** 🔧 Using tool: `view` — /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc/apps/web/src/components/tasks/task-list-view.tsx
**[2026-03-31 21:00:30]** 🔧 Using tool: `report_intent` — {"intent":"Committing and pushing changes"}
**[2026-03-31 21:00:30]** 🔧 Using tool: `bash` — `cd /Users/matancohen/microsoft/openspace-for-ai-squad/.git-worktrees/task-hrViAwMc && git add apps/web/src/hooks/use-task-filter-params.ts apps/web/src/components/tasks/kanban-board.tsx apps/web/src/components/tasks/task-list-view.tsx apps/web/src/components/tasks/__tests__/kanban-board.test.tsx apps/web/src/components/tasks/__tests__/task-list-view.test.tsx apps/web/src/components/tasks/__tests__/tasks-page.test.tsx && git commit -m "feat: persist kanban filter state in URL search params

Add useTaskFilterParams hook that syncs TaskFilters (status, priority,
assignee, search) with URL query parameters using Next.js useSearchParams
and useRouter. Filters now survive page refreshes and can be shared via
URL. Applied to both kanban board and list view for consistent UX.

- Only non-default filter values appear in the URL to keep it clean
- Invalid URL param values gracefully fall back to defaults
- Uses router.replace (not push) to avoid polluting browser history
- Updated tests to mock next/navigation

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>" && git push origin task/task-hrViAwMc 2>&1 | tail -10`
**Branch:** `task/task-hrViAwMc`

**[2026-03-31 21:00:51]** ✅ Fry completed this task.

**Result:**
Lint (eslint + prettier) passed and the push succeeded. Here's what I did:

## Summary

**Created `useTaskFilterParams` hook** (`apps/web/src/hooks/use-task-filter-params.ts`) that syncs `TaskFilters` with URL search params:
- Reads `?status=`, `?priority=`, `?assignee=`, `?search=` on mount
- Validates params (invalid values fall back to defaults)
- Only writes non-default values to keep URLs clean
- Uses `router.replace()` to avoid polluting browser history

**Updated both views** to use the hook:
- `kanban-board.tsx` — replaced `useState` with `useTaskFilterParams`
- `task-list-view.tsx` — same change for consistent UX across views

**Updated 3 test files** to mock `next/navigation` (`useSearchParams`, `useRouter`, `usePathname`).

Example URL: `/tasks?status=in-progress&priority=P0&assignee=fry&search=auth` — bookmarkable and shareable! 🎉
