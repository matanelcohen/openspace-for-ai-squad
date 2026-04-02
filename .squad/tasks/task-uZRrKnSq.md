---
id: task-uZRrKnSq
title: Write tests for Suspense fallback and AsyncBoundary
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-f7Gkgfyl'
created: '2026-04-02T03:18:42.916Z'
updated: '2026-04-02T03:18:42.920Z'
sortIndex: 668
parent: task-f7Gkgfyl
dependsOn:
  - task-GQ2DKJmi
---
After the components are created, write comprehensive tests following the existing pattern in `apps/web/src/components/__tests__/error-boundary.test.tsx` (Vitest + React Testing Library).

Create:

1. **`apps/web/src/components/__tests__/suspense-fallback.test.tsx`**:
   - Test each variant renders correctly (spinner, skeleton, minimal)
   - Test custom className is applied
   - Test optional message prop renders loading text
   - Test default variant behavior

2. **`apps/web/src/components/__tests__/async-boundary.test.tsx`**:
   - Test that children render when no error/suspense
   - Test that Suspense fallback shows during lazy loading (use `React.lazy` with a delayed import or a promise-throwing component)
   - Test that ErrorBoundary fallback shows when child throws
   - Test that custom fallbacks override defaults
   - Test `withAsyncBoundary` HOC wraps component correctly
   - Test error recovery (reset behavior)

Run tests with: `pnpm vitest run apps/web/src/components/__tests__/suspense-fallback.test.tsx apps/web/src/components/__tests__/async-boundary.test.tsx`

Ensure all tests pass. Fix any issues found.
