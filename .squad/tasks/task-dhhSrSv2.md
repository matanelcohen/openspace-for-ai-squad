---
id: task-dhhSrSv2
title: Write tests for ErrorBoundary and Suspense fallback
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-kpoGj3O3'
created: '2026-04-02T03:09:46.722Z'
updated: '2026-04-02T03:09:46.727Z'
sortIndex: 666
parent: task-kpoGj3O3
dependsOn:
  - task-h_oImrzK
---
Write comprehensive tests using vitest + React Testing Library (the project already has vitest configured at root):

**ErrorBoundary tests:**
- Renders children when no error occurs
- Renders fallback UI when a child component throws
- Renders custom fallback when `fallback` prop is provided
- Calls `onError` callback with error and errorInfo
- 'Try Again' button resets the boundary and re-renders children
- Calls `onReset` callback when reset is triggered

**SuspenseFallback tests:**
- Renders with default props (spinner visible, default message)
- Renders custom `message` text
- Applies correct size classes for sm/md/lg
- Renders in fullScreen mode with appropriate layout

Place tests co-located with the components (e.g., `ErrorBoundary.test.tsx`, `SuspenseFallback.test.tsx`). Run `pnpm vitest run` to verify all tests pass.
