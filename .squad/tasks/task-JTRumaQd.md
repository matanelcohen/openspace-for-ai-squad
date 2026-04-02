---
id: task-JTRumaQd
title: Verify stable keys and React reconciliation behavior
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-2qrpeOQO'
created: '2026-04-02T02:15:49.583Z'
updated: '2026-04-02T02:15:49.585Z'
sortIndex: 628
parent: task-2qrpeOQO
dependsOn:
  - task-zixW3Fsu
---
After the frontend fixes are applied, verify that:

1. **No remaining index-as-key usage** — Run `grep -rn 'key={index}\|key={i}\|key={idx}' apps/web/` across the three target files (search-highlight.tsx, decision-card.tsx, squad-init-wizard.tsx) to confirm no index-based keys remain.

2. **TypeScript compiles cleanly** — Run the project's type-check command to ensure no type errors were introduced.

3. **Build succeeds** — Run `pnpm build` (or the web app's build command) to verify the changes don't break the build.

4. **Existing tests pass** — Run any existing test suites for the web app (`pnpm test` or `vitest`) to confirm no regressions.

5. **Key uniqueness** — Review each changed .map() call to confirm the new keys are guaranteed unique within their sibling list (no potential for duplicates).
