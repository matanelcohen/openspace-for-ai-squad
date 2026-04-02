---
id: task-BAVWBgZ1
title: Create reusable ErrorPage component and add error.tsx to all feature routes
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-R38YzmG9'
created: '2026-04-02T04:03:15.795Z'
updated: '2026-04-02T04:08:11.520Z'
sortIndex: 684
parent: task-R38YzmG9
---
This is a Next.js 14 App Router project (apps/web/app/). An ErrorBoundary component already exists at apps/web/src/components/error-boundary.tsx using shadcn Card/Button + Tailwind. Your job:

1. Create a reusable `ErrorPage` client component at `apps/web/src/components/error-page.tsx` that follows Next.js error.tsx conventions — it must accept `{ error: Error & { digest?: string }; reset: () => void }` props. Use the existing ErrorBoundary's UI style (shadcn Card, AlertTriangle icon, destructive styling, 'Try Again' button calling reset(), 'Go Home' link). Show error.message in dev mode only.

2. Add `error.tsx` files to ALL 17 top-level feature route directories:
   - chat, costs, cron, decisions, escalations, github, knowledge, memories, sandboxes, settings, skills, tasks, team-members, terminal, traces, voice, workflows
   Each error.tsx should be a 'use client' file that imports and renders the shared ErrorPage component, passing through error and reset props.

3. Add a root-level `apps/web/app/error.tsx` as a catch-all for any route not covered.

4. Add `apps/web/app/global-error.tsx` for errors in the root layout itself (this must include its own <html><body> tags since it replaces the root layout).

Existing files to reference for style: apps/web/src/components/error-boundary.tsx, apps/web/app/layout.tsx, apps/web/src/components/ui/card.tsx, apps/web/src/components/ui/button.tsx.

---
**[2026-04-02 04:08:04]** 🚀 Fry started working on this task.
**[2026-04-02 04:08:04]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 04:08:11]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
