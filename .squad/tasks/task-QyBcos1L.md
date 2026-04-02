---
id: task-QyBcos1L
title: Implement ErrorBoundary and Suspense fallback components
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-kpoGj3O3'
created: '2026-04-02T02:58:43.467Z'
updated: '2026-04-02T03:15:59.215Z'
sortIndex: 656
parent: task-kpoGj3O3
---
Create a reusable React ErrorBoundary class component in packages/ui (or apps/web/src/components/shared) with: (1) configurable retry strategy — expose a `maxRetries` prop with default 3, an `onError` callback, and a `fallback` render prop for custom error UI; (2) a default error fallback UI showing error message + 'Try Again' button that triggers retry via key reset; (3) a reusable Suspense skeleton/fallback component with variants — a generic pulsing skeleton, a card skeleton, and a full-page spinner — selectable via a `variant` prop. Export both from a shared barrel file. Use the existing project styling conventions (check for Tailwind or CSS modules in the codebase). Ensure components are typed with TypeScript and follow existing patterns in the repo.

---
**[2026-04-02 03:07:50]** 🚀 Fry started working on this task.
**[2026-04-02 03:07:50]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 03:15:59]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
