---
id: task-5gs8Oran
title: Test SSR safety and preset validation
status: pending
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-EqT10rca'
created: '2026-04-02T11:09:00.085Z'
updated: '2026-04-02T11:09:00.087Z'
sortIndex: 88
parent: task-EqT10rca
dependsOn:
  - task-IqybmDlm
---
After the frontend changes land, write or update tests for the TaskFiltersToolbar preset loading logic:
1. Test that loadPresets returns [] when window is undefined (SSR environment).
2. Test that valid localStorage data is correctly parsed and loaded after mount.
3. Test that corrupt/malformed localStorage data (wrong types, missing fields, non-array JSON, invalid JSON string) is handled gracefully — returns [] and does not throw.
4. Test that the component renders without errors during initial server-side render (no localStorage access before mount).
5. Run the full test suite (`pnpm test`) and ensure nothing is broken.

Use the existing test framework (vitest + testing-library if available). Place tests alongside the component or in the existing test directory structure.
