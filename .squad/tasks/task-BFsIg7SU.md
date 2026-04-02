---
id: task-BFsIg7SU
title: Add error.tsx route files and wrap feature pages with ErrorBoundary
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-rqnzNaNB'
created: '2026-04-02T00:30:34.671Z'
updated: '2026-04-02T01:42:03.552Z'
sortIndex: 537
parent: task-rqnzNaNB
---
An ErrorBoundary component already exists at apps/web/src/components/error-boundary.tsx with retry UI, dev error display, and withErrorBoundary HOC. What's missing is route-level error handling. Tasks:

1. Create `apps/web/app/error.tsx` — a root-level Next.js error boundary that catches unhandled errors across all routes. Use the existing ErrorBoundary styling (AlertTriangle icon, 'Try Again' + 'Go Home' buttons). Must be a client component ('use client').
2. Create `error.tsx` files for key route segments: `chat/error.tsx`, `tasks/error.tsx`, `workflows/error.tsx`, `decisions/error.tsx`, `escalations/error.tsx`, `team-members/error.tsx`, `settings/error.tsx`. Each should show a route-specific error message with retry.
3. On the dashboard page (`app/page.tsx`), wrap the independent data sections (SummaryStats, SystemStatus, TeamSummaryStats, AgentGrid, DashboardActivitySidebar) individually with the existing `<ErrorBoundary>` component so one section crashing doesn't take down the whole page. Each ErrorBoundary should have a meaningful fallback (e.g., 'Failed to load system status').
4. Do the same for other complex feature pages that render multiple independent sections (e.g., tasks list page, team-members page).

The existing ErrorBoundary supports custom fallback props. Use descriptive section names in fallbacks.

---
**[2026-04-02 00:33:30]** 🚀 Fry started working on this task.
**[2026-04-02 00:33:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:33:42]** 🚀 Fry started working on this task.
**[2026-04-02 00:33:42]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:34:09]** 🚀 Fry started working on this task.
**[2026-04-02 00:34:09]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:34:15]** 🚀 Fry started working on this task.

---
**[2026-04-02 00:34:16]** 🚀 Fry started working on this task.
**[2026-04-02 00:34:16]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:35:51]** 🚀 Fry started working on this task.
**[2026-04-02 00:35:51]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:36:14]** 🚀 Fry started working on this task.
**[2026-04-02 00:36:14]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:38]** 🚀 Fry started working on this task.
**[2026-04-02 00:37:38]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 01:12:27]** 🚀 Fry started working on this task.
**[2026-04-02 01:12:27]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 01:42:03]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
