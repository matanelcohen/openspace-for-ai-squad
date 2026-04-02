---
id: task-rp3QvVpG
title: Build ErrorBoundary and Suspense fallback components
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-kpoGj3O3'
created: '2026-04-02T03:08:49.666Z'
updated: '2026-04-02T03:17:36.944Z'
sortIndex: 661
parent: task-kpoGj3O3
---
Create reusable React ErrorBoundary class component and Suspense fallback components in the shared UI layer (e.g. `packages/ui` or `apps/web/src/components`). The ErrorBoundary should: (1) catch render errors via componentDidCatch, (2) display a user-friendly error message with a retry button, (3) accept `fallback` and `onError` props for customization, (4) support `resetKeys` pattern to auto-recover when context changes. The Suspense fallback should: (1) provide a reusable loading skeleton/spinner component, (2) support variant props (full-page, inline, card-sized). Export both from a central barrel file. Wire them into the app's top-level layout and around any lazy-loaded routes.

---
**[2026-04-02 03:08:49]** 🚀 Fry started working on this task.
**[2026-04-02 03:08:49]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 03:17:36]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
