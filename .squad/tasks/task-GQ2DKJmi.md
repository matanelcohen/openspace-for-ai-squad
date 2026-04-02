---
id: task-GQ2DKJmi
title: Create Suspense fallback and AsyncBoundary components
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-f7Gkgfyl'
created: '2026-04-02T03:18:42.870Z'
updated: '2026-04-02T03:25:30.047Z'
sortIndex: 667
parent: task-f7Gkgfyl
---
The codebase already has an ErrorBoundary at `apps/web/src/components/error-boundary.tsx` (class component with `withErrorBoundary` HOC, custom fallback prop, Try Again/Go Home buttons, co-located tests). No Suspense components exist yet.

Create the following:

1. **`apps/web/src/components/ui/suspense-fallback.tsx`** — A reusable Suspense fallback component with variants:
   - `spinner` variant: reuses the existing `LoadingSpinner` from `@/components/ui/loading-spinner`
   - `skeleton` variant: reuses `SkeletonCard` from `@/components/ui/skeleton-card`
   - `minimal` variant: simple pulsing dots or text
   - Use CVA (class-variance-authority) for variants, matching the pattern in `button.tsx`
   - Use `cn()` from `@/lib/utils` for class merging
   - Export as `'use client'` component with `React.forwardRef`
   - Props: `variant`, `className`, `message` (optional loading text)

2. **`apps/web/src/components/async-boundary.tsx`** — A combined ErrorBoundary + Suspense wrapper:
   - Wraps children in both `<ErrorBoundary>` and `<Suspense>` 
   - Import ErrorBoundary from `@/components/error-boundary`
   - Import SuspenseFallback from `@/components/ui/suspense-fallback`
   - Props: `errorFallback?`, `suspenseFallback?`, `onError?`, `onReset?`, `children`
   - `'use client'` directive
   - Export both `AsyncBoundary` component and a `withAsyncBoundary` HOC

3. **Review existing ErrorBoundary** at `apps/web/src/components/error-boundary.tsx` — ensure it has an `onReset` callback prop so AsyncBoundary can hook into reset behavior. Add it if missing.

Follow existing patterns: Tailwind utilities, Radix color tokens (destructive, muted, card, foreground), lucide-react icons, path alias `@/`.

Run `pnpm build --filter=web` to verify no type errors.

---
**[2026-04-02 03:25:22]** 🚀 Fry started working on this task.
**[2026-04-02 03:25:22]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 03:25:30]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
