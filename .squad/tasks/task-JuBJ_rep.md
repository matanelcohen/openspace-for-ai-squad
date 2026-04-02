---
id: task-JuBJ_rep
title: Write tests for ErrorBoundary and Suspense fallback components
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-kpoGj3O3'
created: '2026-04-02T03:09:07.475Z'
updated: '2026-04-02T03:09:07.478Z'
sortIndex: 664
parent: task-kpoGj3O3
dependsOn:
  - task-Txxf1wkg
---
Write unit tests for the two new components:

1. **ErrorBoundary tests:**
   - Renders children normally when no error
   - Shows default fallback UI when a child throws
   - Shows custom fallback when `fallback` prop is provided
   - 'Try Again' button resets the error state and re-renders children
   - `componentDidCatch` is called with error info

2. **SuspenseFallback tests:**
   - Renders loading indicator by default
   - Renders custom message when `message` prop is provided
   - Matches snapshot for visual regression

Use the existing test framework configured in the repo (vitest). Place tests co-located with the components or in the appropriate test directory following existing conventions.
