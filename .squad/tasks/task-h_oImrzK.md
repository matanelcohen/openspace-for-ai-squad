---
id: task-h_oImrzK
title: Implement ErrorBoundary and Suspense fallback components
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-kpoGj3O3'
created: '2026-04-02T03:09:46.666Z'
updated: '2026-04-02T03:18:26.516Z'
sortIndex: 665
parent: task-kpoGj3O3
---
Create two reusable React components in the shared UI layer (likely `packages/ui` or `apps/web/src/components`):

1. **ErrorBoundary** — a class component (React error boundaries require class components) that:
   - Catches JavaScript errors in its child component tree
   - Renders a user-friendly fallback UI with error message and a 'Try Again' button that resets the boundary
   - Accepts props: `fallback` (optional custom fallback ReactNode), `onError` (optional error callback), `onReset` (optional reset callback)
   - Logs errors (console.error at minimum)
   - Exports a `useErrorBoundary` hook or `withErrorBoundary` HOC for convenience

2. **SuspenseFallback** — a functional component that:
   - Provides a visually consistent loading state for React.Suspense boundaries
   - Accepts props: `message` (optional loading text), `size` ('sm' | 'md' | 'lg'), `fullScreen` (boolean)
   - Uses existing design tokens/tailwind classes from the project
   - Includes a spinner/skeleton animation

Both components should be exported from the package barrel file. Check existing component patterns in the codebase for style conventions.

---
**[2026-04-02 03:09:46]** 🚀 Fry started working on this task.
**[2026-04-02 03:09:46]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 03:18:26]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
