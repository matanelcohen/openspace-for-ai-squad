---
id: task-z8lQcuIb
title: Test error and loading boundaries
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-teLWKQEC'
created: '2026-04-02T03:39:40.650Z'
updated: '2026-04-02T03:39:40.676Z'
sortIndex: 674
parent: task-teLWKQEC
dependsOn:
  - task-wuBH0Egl
  - task-a0FKTETp
---
Verify all error.tsx and loading.tsx boundaries work correctly across the app.

**Tests to write (in `apps/web/` test directory, colocated or in `__tests__/`):**

1. **Unit tests for shared components:**
   - Test `RouteError` component renders error message, reset button, and home link
   - Test `RouteError` hides error details in production mode
   - Test reset button calls the `reset()` callback
   - Test `RouteLoading` skeleton variants (ListPageSkeleton, DetailPageSkeleton, FormPageSkeleton) render without errors

2. **Coverage audit:**
   - Write a test that globs all route directories under `apps/web/app/` that contain a `page.tsx` and asserts they also contain both `error.tsx` and `loading.tsx` (structural completeness check)
   - Verify `global-error.tsx` exists at the app root

3. **Rendering tests:**
   - For a sample of 3-4 error.tsx files (e.g., root, tasks, skills/[id], workflows), render the component with mock error+reset props and snapshot test
   - For a sample of 3-4 loading.tsx files, render and snapshot test

**Use vitest + @testing-library/react (already in the project).** Run existing tests first (`pnpm test`) to confirm nothing is broken, then add the new tests.
