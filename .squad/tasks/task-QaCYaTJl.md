---
id: task-QaCYaTJl
title: Add missing validation rules and reset confirmation
status: in-progress
priority: P2
assignee: fry
labels:
  - 'parent:task-SQ-N7gVL'
created: '2026-04-02T03:50:47.829Z'
updated: '2026-04-02T03:50:48.041Z'
sortIndex: 678
parent: task-SQ-N7gVL
dependsOn:
  - task-UufiIdGd
---
In `apps/web/src/components/escalations/escalation-chain-editor.tsx`, the `validateChain` function (lines 37-45) is missing several important checks, and the reset handler has no confirmation.

**Validation additions** — update `validateChain` to also check:
1. `level.reviewerIds.length === 0` → return `Level ${level.level}: at least one reviewer is required`
2. Duplicate chain names within `items` — in the save handler (or a new `validateAll` function), check that no two chains share the same `name.trim().toLowerCase()`; return `Duplicate chain name: ${name}`.

**Rollback confirmation** — in `handleReset` (line ~168), only proceed if `isDirty` is false OR the user confirms via `window.confirm('Discard unsaved changes?')`. If they cancel, return early.

**Files to edit:** `apps/web/src/components/escalations/escalation-chain-editor.tsx`

Run the existing tests afterward to make sure nothing breaks.
