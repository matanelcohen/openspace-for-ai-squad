---
id: task-icWPoXpK
title: Test escalation counter and WebSocket fixes
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-Dshzn6i-'
created: '2026-04-02T11:06:39.435Z'
updated: '2026-04-02T11:06:39.438Z'
sortIndex: 73
parent: task-Dshzn6i-
dependsOn:
  - task-3TW6gVoG
---
Verify the two bug fixes in the escalation chain UI:

1. **Counter isolation test**: Confirm that mounting multiple `EscalationChainEditor` instances simultaneously does not produce duplicate keys. Verify that unmounting and remounting a component resets its counter (no unbounded growth).

2. **WebSocket staleness test**: Confirm that navigating from escalation ID 'A' to escalation ID 'B' causes real-time updates to target escalation 'B' (not 'A'). Verify the old listener for ID 'A' is cleaned up (no lingering subscriptions). Test rapid navigation between multiple escalation IDs to ensure no stale closures remain.

Add or update tests in the relevant test files. Run the existing test suite to ensure no regressions.
