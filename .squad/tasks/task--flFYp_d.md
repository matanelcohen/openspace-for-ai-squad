---
id: task--flFYp_d
title: Create shared DetailPageLayout and ViewModeToggle components
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-kx-cbz6F'
created: '2026-04-02T01:59:12.756Z'
updated: '2026-04-02T02:14:45.867Z'
sortIndex: 587
parent: task-kx-cbz6F
---
Create two new shared components in /apps/web/src/components/:

1. **DetailPageLayout** (`detail-page-layout.tsx`): A generic wrapper component that handles the loading → error → content guard pattern duplicated across 7 detail pages. Props should include: `data: T | null`, `isLoading: boolean`, `error: Error | null`, `children: (data: T) => ReactNode` (render prop for content), `backHref: string`, `backLabel?: string`, `loadingContent?: ReactNode` (custom skeleton, default to a standard Skeleton grid), `notFoundMessage?: string`, `errorPrefix?: string`, `testId?: string`, `className?: string`. Loading state should render configurable skeletons (default: `<Skeleton className="h-8 w-48" />` + `<Skeleton className="h-64 w-full" />`). Error state should render back-navigation link + destructive alert with error message. Use existing `Skeleton`, `Button`, and `Link` imports. Follow the existing pattern from tasks/[id] and workflows/[id] pages as reference.

2. **ViewModeToggle** (`view-mode-toggle.tsx`): A generic toggle component replacing the duplicated board/list toggle in tasks/page.tsx and team-members/page.tsx. Props: `value: T`, `onChange: (mode: T) => void`, `modes: Array<{ value: T; label: string; icon: ComponentType<{className?: string}> }>`, `testId?: string`, `className?: string`. Render using the existing `Button` component with variant='outline'/'default' based on active state, matching the current toggle UI pattern.

3. **ErrorBoundary wrapper around ChatClient**: In `/apps/web/app/chat/page.tsx`, wrap the `<ChatClient />` with the existing `<ErrorBoundary>` component (from `/apps/web/src/components/error-boundary.tsx`) or use the `withErrorBoundary` HOC. Add a user-friendly fallback that shows an error message and a retry button.

All components must be 'use client' where needed, export proper TypeScript generics, and include data-testid attributes for testing.

---
**[2026-04-02 01:59:13]** 🚀 Fry started working on this task.
**[2026-04-02 01:59:13]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:14:45]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
