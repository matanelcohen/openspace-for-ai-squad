---
id: task-FjLzKNUF
title: Add not-found.tsx route files for 404 handling
status: blocked
priority: P2
assignee: bender
labels:
  - 'parent:task-R38YzmG9'
created: '2026-04-02T04:03:15.836Z'
updated: '2026-04-02T04:05:53.197Z'
sortIndex: 685
parent: task-R38YzmG9
---
While the team is adding error handling, also add not-found.tsx route files for proper 404 handling across the app. This is a Next.js 14 App Router project (apps/web/app/).

1. Create `apps/web/app/not-found.tsx` — a root-level 404 page using the same shadcn UI styling (Card, Button) as the error boundary component at apps/web/src/components/error-boundary.tsx. Show a friendly 'Page Not Found' message with a 'Go Home' link to '/'.

2. Add `not-found.tsx` to dynamic route segments where invalid IDs are likely:
   - apps/web/app/escalations/[id]/not-found.tsx
   - apps/web/app/sandboxes/[id]/not-found.tsx  
   - apps/web/app/skills/[id]/not-found.tsx
   - apps/web/app/tasks/[id]/not-found.tsx
   - apps/web/app/team-members/[id]/not-found.tsx
   - apps/web/app/traces/[traceId]/not-found.tsx
   - apps/web/app/workflows/[id]/not-found.tsx

These should show context-specific messages like 'Task not found' or 'Workflow not found' with a link back to the parent list page (e.g., /tasks, /workflows).

Use 'use client' directive, shadcn Card + Button, Lucide FileQuestion icon, Tailwind styling consistent with the existing app.

---
**[2026-04-02 04:05:42]** 🚀 Bender started working on this task.
**[2026-04-02 04:05:42]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 04:05:53]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
