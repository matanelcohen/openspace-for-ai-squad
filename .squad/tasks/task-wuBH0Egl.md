---
id: task-wuBH0Egl
title: Create error.tsx boundaries for all route segments
status: blocked
priority: P2
assignee: bender
labels:
  - 'parent:task-teLWKQEC'
created: '2026-04-02T03:39:39.843Z'
updated: '2026-04-02T03:44:45.387Z'
sortIndex: 672
parent: task-teLWKQEC
---
Create error boundary files for the Next.js app. There are 28 pages across ~17 route segments and zero error.tsx files currently.

**What to create:**
1. `apps/web/app/global-error.tsx` — root-level error boundary (must use html/body tags since it replaces root layout)
2. `apps/web/app/error.tsx` — catch-all for the app root
3. One `error.tsx` per top-level route directory: cron, costs, memories, workflows, tasks, traces, skills, sandboxes, settings, team-members, escalations, chat, github, knowledge, voice, decisions, terminal
4. One `error.tsx` per dynamic/nested segment: workflows/[id], tasks/[id], traces/[traceId], skills/[id], skills/agents/[agentId], skills/gallery/[id], sandboxes/[id], team-members/[id], escalations/[id], escalations/config, workflows/compose

**Pattern to follow (all must be 'use client'):**
- Import the existing `ErrorBoundary`-style UI pattern from `apps/web/src/components/ErrorBoundary.tsx`
- Show error message (in dev only via process.env.NODE_ENV), a reset button calling `reset()`, and a 'Go Home' link
- Use Tailwind + Lucide icons (AlertTriangle) consistent with existing UI
- The `error.tsx` component receives `{ error: Error & { digest?: string }; reset: () => void }` props
- Keep it DRY: create a shared `apps/web/src/components/RouteError.tsx` component and have each error.tsx import+re-export it with the route name for context

---
**[2026-04-02 03:44:39]** 🚀 Bender started working on this task.
**[2026-04-02 03:44:39]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 03:44:45]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
