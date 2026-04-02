---
id: task-gFKM_9uN
title: Test SSR-safe key generation in escalation components
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-0FMxfjS1'
created: '2026-04-02T02:27:29.439Z'
updated: '2026-04-02T02:27:29.443Z'
sortIndex: 652
parent: task-0FMxfjS1
dependsOn:
  - task-J9nQKJP2
---
Verify the SSR-safety fix in the two escalation editor components:

1. Run `pnpm build` (or the Next.js build for `apps/web`) to confirm no build errors and no SSR hydration warnings.
2. Run existing tests: `pnpm test` or the vitest suite to ensure nothing is broken.
3. Check that the two modified files no longer have any module-level mutable state (`let keyCounter`, `let chainKeyCounter`).
4. Verify the fix by grepping `apps/web/src/components/escalations/` for `let.*Counter` or `let.*counter` — there should be zero matches at module level.
5. If there are existing tests for `ThresholdConfigPanel` or `EscalationChainEditor`, run them specifically and confirm they pass.
6. Verify `useId` and `useRef` are properly imported in both files.

Files to check:
- `apps/web/src/components/escalations/threshold-config-panel.tsx`
- `apps/web/src/components/escalations/escalation-chain-editor.tsx`
