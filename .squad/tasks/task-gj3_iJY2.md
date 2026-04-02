---
id: task-gj3_iJY2
title: Add tests for new validation rules and reset confirmation
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-SQ-N7gVL'
created: '2026-04-02T03:50:48.039Z'
updated: '2026-04-02T03:50:48.042Z'
sortIndex: 679
parent: task-SQ-N7gVL
dependsOn:
  - task-QaCYaTJl
---
In `apps/web/src/components/escalations/__tests__/escalation-chain-editor.test.tsx`, add test coverage for the new behaviors:

1. **Reviewer validation test:** Create a chain with a level that has `reviewerIds: []`, attempt to save, assert Save button is disabled or validation error appears.
2. **Duplicate chain name test:** Create two chains with the same name, attempt to save, assert validation prevents it.
3. **Reset confirmation test:** Make edits (set dirty state), click Reset, mock `window.confirm` to return `false`, assert state is NOT reset. Then mock it to return `true`, assert state IS reset.
4. **Key counter isolation test:** Mount the component, unmount it, mount it again — assert that keys are generated correctly and don't depend on prior mount state. This verifies the useRef fix.

Run with: `pnpm --filter @openspace/web exec vitest run src/components/escalations/__tests__/escalation-chain-editor.test.tsx`
