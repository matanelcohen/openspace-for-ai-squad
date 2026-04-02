---
id: task-Txxf1wkg
title: Implement ErrorBoundary and Suspense fallback components
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-kpoGj3O3'
created: '2026-04-02T03:09:07.238Z'
updated: '2026-04-02T03:17:41.610Z'
sortIndex: 663
parent: task-kpoGj3O3
---
Create reusable React components in the web app:

1. **ErrorBoundary** — a class component (React requirement) that catches rendering errors in its subtree. Should:
   - Display a user-friendly fallback UI with error message and a 'Try Again' button that resets state
   - Accept `fallback` prop for custom fallback UI override
   - Log errors via `componentDidCatch` (console for now, prep for future telemetry)
   - Export from a shared components directory (e.g. `apps/web/src/components/error-boundary/`)

2. **SuspenseFallback** — a presentational component for use as `<Suspense fallback={...}>`. Should:
   - Show a centered loading spinner/skeleton with optional `message` prop
   - Be visually consistent with the app's design system
   - Export from a shared components directory (e.g. `apps/web/src/components/suspense-fallback/`)

3. **Barrel export** — re-export both from a shared index so consumers can `import { ErrorBoundary, SuspenseFallback } from '@/components'`

Look at the existing component patterns and styling approach in the web app to stay consistent.

---
**[2026-04-02 03:09:07]** 🚀 Fry started working on this task.
**[2026-04-02 03:09:07]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 03:17:41]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
