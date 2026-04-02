---
id: task-DVRQzD_9
title: Test error boundaries and not-found pages
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-R38YzmG9'
created: '2026-04-02T04:03:15.877Z'
updated: '2026-04-02T04:03:15.880Z'
sortIndex: 686
parent: task-R38YzmG9
dependsOn:
  - task-BAVWBgZ1
  - task-FjLzKNUF
---
Write tests to verify the new error handling works correctly. The existing test lives at apps/web/src/components/__tests__/error-boundary.test.tsx — use it as a reference for patterns and test utilities.

1. Write tests for the new `ErrorPage` component (apps/web/src/components/error-page.tsx):
   - Renders error message in development
   - Calls reset() when 'Try Again' is clicked
   - Shows 'Go Home' link
   - Handles errors with digest property

2. Write tests for a representative error.tsx route file (e.g., apps/web/app/tasks/error.tsx):
   - Verify it's a client component
   - Verify it renders the ErrorPage component with correct props

3. Write tests for the root not-found.tsx:
   - Renders 'Page Not Found' message
   - Shows navigation link to home

4. Write tests for a dynamic route not-found.tsx (e.g., apps/web/app/tasks/[id]/not-found.tsx):
   - Shows context-specific 'Task not found' message
   - Links back to /tasks

Use vitest + @testing-library/react. Check vitest.config.ts and existing tests for project conventions. Run `pnpm test` from apps/web or the repo root to verify all tests pass.
