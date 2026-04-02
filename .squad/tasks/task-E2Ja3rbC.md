---
id: task-E2Ja3rbC
title: Add tests for SSR-safe key generation in escalation components
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-0FMxfjS1'
created: '2026-04-02T02:54:15.908Z'
updated: '2026-04-02T02:54:15.912Z'
sortIndex: 655
parent: task-0FMxfjS1
dependsOn:
  - task-AOV_RZhA
---
After the frontend refactoring is done, verify correctness:

1. Run existing tests: `cd apps/web && npx vitest run --reporter=verbose -- escalation` to ensure nothing broke.
2. For `threshold-config-panel.tsx`: Write or update tests to verify that rendering the component twice produces unique, non-colliding keys (no shared mutable state between instances).
3. For `escalation-chain-editor.tsx`: Same — verify two independent renders don't share key counters.
4. Verify there are no remaining module-level mutable counters in either file: `grep -n 'let.*Counter\|let.*counter' apps/web/src/components/escalations/`.
5. Run the full web test suite to confirm no regressions: `cd apps/web && npx vitest run`.
