---
id: task-kDJ7UCOj
title: Write tests for ErrorBoundary and Suspense fallback components
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-kpoGj3O3'
created: '2026-04-02T02:58:43.501Z'
updated: '2026-04-02T02:58:43.503Z'
sortIndex: 657
parent: task-kpoGj3O3
dependsOn:
  - task-QyBcos1L
---
Write unit tests (Vitest + React Testing Library, matching the existing vitest.config.ts setup) covering: (1) ErrorBoundary — renders children when no error, renders fallback UI when child throws, retry button resets and re-renders children, respects maxRetries limit, calls onError callback with error info, works with custom fallback render prop; (2) Suspense fallbacks — each variant (skeleton, card, spinner) renders correctly, components are accessible (appropriate ARIA attributes). Aim for full branch coverage on the ErrorBoundary retry logic.
