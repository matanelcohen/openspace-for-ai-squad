---
id: task-auak0YtF
title: Add tests for invalid data handling in escalation components
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-qXw7ldX4'
created: '2026-04-02T02:18:59.922Z'
updated: '2026-04-02T02:18:59.924Z'
sortIndex: 636
parent: task-qXw7ldX4
dependsOn:
  - task-juBFr5Eh
---
Write tests covering the new defensive behavior in the four escalation components:

1. **PriorityIndicator**: Test rendering with an unknown priority value (e.g., 'critical-ultra') — should render fallback styling, not throw.
2. **EscalationStatusBadge**: Test rendering with an unknown status string — should render fallback badge, not throw.
3. **SLACountdown**: Test with invalid date strings ('not-a-date', empty string, undefined) — should render fallback text, no NaN in output.
4. **EscalationChainEditor**: Test that validation errors are actually rendered in the DOM when invalid input is provided (e.g., empty required fields, invalid chain entries).

Use the existing test framework (Vitest + React Testing Library). Place tests alongside existing test files for these components. Each test should verify no runtime errors and correct fallback rendering.
