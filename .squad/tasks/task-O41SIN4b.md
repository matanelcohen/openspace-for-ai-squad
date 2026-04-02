---
id: task-O41SIN4b
title: Write accessibility and case-bug regression tests
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-EhKmEKPF'
created: '2026-04-02T03:30:52.640Z'
updated: '2026-04-02T03:30:52.644Z'
sortIndex: 671
parent: task-EhKmEKPF
dependsOn:
  - task-gYZACk27
  - task-J3z_Gt7I
---
Write tests covering the keyboard accessibility, ARIA support, and actor name case bug fix:

1. **Actor name case bug regression test**: Test that agent resolution works with mixed-case actorIds (e.g. 'Reviewer-1', 'reviewer-1', 'REVIEWER-1') in both `audit-trail-timeline` and `escalation-detail-panel`.
2. **Keyboard accessibility tests for review-queue-table**: Test that rows are focusable via Tab, activatable via Enter/Space, and that focus moves correctly.
3. **ARIA attribute tests**: Verify `role`, `aria-label`, and `aria-live` attributes are present on badge components, table rows, and bulk selection region.
4. **Screen reader announcement test**: Verify the `aria-live` region updates when bulk selection count changes.

Place tests alongside existing test files in the `__tests__/` directories of the respective component folders.
