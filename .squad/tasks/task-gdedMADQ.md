---
id: task-gdedMADQ
title: Test accessibility and case-sensitivity fixes
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-cnoC89oM'
created: '2026-04-02T03:01:02.807Z'
updated: '2026-04-02T03:01:02.905Z'
sortIndex: 660
parent: task-cnoC89oM
dependsOn:
  - task-wufOvHex
---
Verify all changes from both subtasks:

**Case-sensitivity tests:**
- Add unit/integration tests for `escalation-detail-panel.tsx` agent lookup with mixed-case IDs (e.g., 'Agent-1' vs 'agent-1')
- Add unit/integration tests for `audit-trail-timeline.tsx` actor resolution with mixed-case actorIds
- Test edge cases: all-caps, all-lower, mixed-case, undefined/null inputs

**Accessibility tests:**
- Extend the existing E2E accessibility test (`e2e/chat-input-a11y.spec.ts`) pattern to cover dialogs, tables, and notification bell
- Test keyboard navigation: Tab through forms, Enter/Space on buttons, Escape to close dialogs
- Test ARIA attributes are present and correct (aria-modal on dialogs, aria-live on notifications, aria-invalid on invalid form fields)
- Run existing tests (`pnpm test` and `pnpm e2e`) to ensure no regressions

**Tools:** Use Playwright for E2E a11y tests. Consider using `@axe-core/playwright` if already available, or test ARIA attributes directly via Playwright locators.
