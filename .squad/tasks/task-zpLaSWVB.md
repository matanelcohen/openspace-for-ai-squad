---
id: task-zpLaSWVB
title: Test shared components and refactored pages
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-kx-cbz6F'
created: '2026-04-02T01:59:13.375Z'
updated: '2026-04-02T01:59:13.393Z'
sortIndex: 589
parent: task-kx-cbz6F
dependsOn:
  - task-Ldt9Qj2w
---
Write comprehensive tests for the new shared components and verify the refactored pages still work correctly:

**Unit tests for new components:**
1. `detail-page-layout.test.tsx` — Test: (a) renders loading skeleton when isLoading=true, (b) renders custom loadingContent when provided, (c) renders error message with back link when error is set, (d) renders 'not found' message when data is null and no error, (e) renders children with data when data is present and not loading, (f) back link navigates to backHref, (g) custom testId is applied, (h) custom className is applied
2. `view-mode-toggle.test.tsx` — Test: (a) renders all mode buttons, (b) highlights active mode, (c) calls onChange when clicking inactive mode, (d) does not call onChange when clicking active mode, (e) renders icons correctly, (f) custom testId is applied
3. `error-boundary-chat.test.tsx` — Test: (a) ChatClient renders normally when no error, (b) ErrorBoundary catches ChatClient crash and shows fallback, (c) retry button in fallback recovers

**Integration tests for refactored pages:**
Verify that existing tests in these locations still pass:
- `/apps/web/src/components/tasks/__tests__/`
- `/apps/web/src/components/__tests__/error-boundary.test.tsx`
- Any other existing detail page tests

Run the full test suite with `pnpm test` or `pnpm vitest` from the repo root. Fix any regressions caused by the refactoring. Use the existing test patterns (React Testing Library + Vitest) found in the codebase. Place new test files alongside their components or in `__tests__/` directories following existing conventions.
