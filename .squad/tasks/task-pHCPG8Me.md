---
id: task-pHCPG8Me
title: Test escalation components after useRef refactor
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-9uIcxK2i'
created: '2026-04-02T03:44:27.397Z'
updated: '2026-04-02T03:44:27.400Z'
sortIndex: 676
parent: task-9uIcxK2i
dependsOn:
  - task-HuWfFjzl
---
After the frontend refactor is complete, verify both components still work correctly: (1) Run existing tests with `pnpm test` (or the relevant test command). (2) Check that `threshold-config-panel.tsx` and `escalation-chain-editor.tsx` have no lint errors (`pnpm lint`). (3) If there are existing test files for these components, ensure they pass. (4) Verify there are no remaining module-level counter variables in the escalations directory with `grep -r 'let.*Counter' apps/web/src/components/escalations/`. The key concern is that multiple component instances no longer share a single counter, which is the correct behavior for React components.
