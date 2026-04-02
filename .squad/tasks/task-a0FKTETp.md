---
id: task-a0FKTETp
title: Create loading.tsx skeletons for all route segments
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-teLWKQEC'
created: '2026-04-02T03:39:40.348Z'
updated: '2026-04-02T03:41:46.508Z'
sortIndex: 673
parent: task-teLWKQEC
---
Create loading boundary files with skeleton UIs for the Next.js app. There are 28 pages across ~17 route segments and zero loading.tsx files currently.

**What to create:**
1. `apps/web/app/loading.tsx` — root loading state
2. One `loading.tsx` per top-level route directory: cron, costs, memories, workflows, tasks, traces, skills, sandboxes, settings, team-members, escalations, chat, github, knowledge, voice, decisions, terminal
3. One `loading.tsx` per dynamic/nested segment: workflows/[id], tasks/[id], traces/[traceId], skills/[id], skills/agents/[agentId], skills/gallery/[id], sandboxes/[id], team-members/[id], escalations/[id], escalations/config, workflows/compose

**Pattern to follow:**
- Use the existing `Skeleton`, `SkeletonCard`, and `LoadingSpinner` components from `apps/web/src/components/ui/`
- Match each page's actual layout structure. For example:
  - List pages (tasks, skills, workflows, etc.): header skeleton + grid of SkeletonCards
  - Detail pages ([id] routes): single large skeleton card with detail lines
  - Chat page: sidebar skeleton + message area skeleton
  - Settings page: form-like skeleton with labeled rows
- For pages with tabbed interfaces (skills), show the tab bar skeleton
- For pages with board views (tasks), show column skeletons
- Keep it DRY: create a shared `apps/web/src/components/RouteLoading.tsx` with common patterns (ListPageSkeleton, DetailPageSkeleton, FormPageSkeleton) and compose them in each loading.tsx
- All loading.tsx files can be server components (no 'use client' needed)

---
**[2026-04-02 03:41:33]** 🚀 Fry started working on this task.
**[2026-04-02 03:41:33]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 03:41:46]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
