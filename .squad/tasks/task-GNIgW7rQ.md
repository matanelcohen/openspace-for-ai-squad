---
id: task-GNIgW7rQ
title: Add tests for ErrorBoundary and Suspense fallbacks
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-kpoGj3O3'
created: '2026-04-02T03:08:49.721Z'
updated: '2026-04-02T03:08:49.724Z'
sortIndex: 662
parent: task-kpoGj3O3
dependsOn:
  - task-rp3QvVpG
---
Write comprehensive tests for the new ErrorBoundary and Suspense fallback components. For ErrorBoundary: (1) test that it catches errors from child components and renders fallback UI, (2) test the retry/reset functionality, (3) test that onError callback fires, (4) test resetKeys auto-recovery, (5) test that it renders children normally when no error. For Suspense fallbacks: (1) test each variant renders correctly (full-page, inline, card), (2) snapshot or visual regression tests for the loading states. Use the existing test framework (vitest + React Testing Library).
