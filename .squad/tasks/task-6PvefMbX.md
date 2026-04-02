---
id: task-6PvefMbX
title: Test keyCounter refactor
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-u6cd3_fe'
created: '2026-04-02T03:56:34.096Z'
updated: '2026-04-02T03:56:34.099Z'
sortIndex: 681
parent: task-u6cd3_fe
dependsOn:
  - task-ulhkaEkm
---
Verify the refactor didn't break anything:
1. Run existing tests for the threshold-config-panel component (check for test files under `apps/web/src/components/escalations/`)
2. Run the full frontend test suite (`pnpm --filter web test` or equivalent)
3. Run the frontend build (`pnpm --filter web build`) to confirm no TypeScript errors
4. If no dedicated tests exist for this component, write a basic React Testing Library test that mounts `ThresholdConfigPanel` twice and confirms each instance generates independent keys (proving no shared module-level state).
