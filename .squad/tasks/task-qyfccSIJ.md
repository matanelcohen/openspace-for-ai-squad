---
id: task-qyfccSIJ
title: Lazy-load MarkdownText with next/dynamic
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-VcyK2556'
created: '2026-04-02T11:03:09.006Z'
updated: '2026-04-02T11:06:40.972Z'
sortIndex: 63
parent: task-VcyK2556
---
In apps/web, refactor the MarkdownText component to be lazy-loaded:
1. In `markdown-text.tsx`, keep the component as-is but ensure it's the default export (it will become the dynamically imported module).
2. Create a new wrapper file (e.g., `markdown-text-lazy.tsx`) that uses `next/dynamic(() => import('./markdown-text'), { ssr: false, loading: () => <MarkdownSkeleton /> })`. The skeleton fallback should be a lightweight placeholder — a few animated pulse lines using Tailwind (e.g., `<div className='space-y-2'><div className='h-4 bg-muted animate-pulse rounded w-3/4' />...</div>`).
3. Update imports in `task-form-dialog.tsx` (line 8) and any other consumers to use the lazy wrapper instead of the direct import.
4. Verify `remark-gfm` is no longer in the initial chunk by running `pnpm build` in apps/web and checking the bundle output — the markdown chunk should appear as a separate lazy-loaded chunk.

---
**[2026-04-02 11:03:12]** 🚀 Fry started working on this task.
**[2026-04-02 11:03:12]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 11:06:40]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
