---
id: task-g064Oqev
title: Test ingestion polling lifecycle
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-71j3OxiS'
created: '2026-04-02T02:12:06.292Z'
updated: '2026-04-02T02:12:06.295Z'
sortIndex: 613
parent: task-71j3OxiS
dependsOn:
  - task-SWFhoPpf
---
Write tests for the fixed ingestion polling in `ingestion-status.tsx`:
1. **Race condition resolved**: Verify that only one timeout controls the `ingesting=false` transition — not competing 5s and 120s timeouts.
2. **No orphaned timers**: Call `handleIngest` multiple times rapidly and verify previous timers are cleared before new ones start.
3. **Unmount cleanup**: Mount the component, start ingestion, unmount, and verify all timers are cleared (no state updates after unmount).
4. **Happy path**: Start ingest → poll status → receive completion → `ingesting` becomes false and polling stops.

Use `vi.useFakeTimers()` to control timer advancement. Check that `clearInterval`/`clearTimeout` are called appropriately.
