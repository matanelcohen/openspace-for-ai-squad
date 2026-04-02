---
id: task-sWyOttN1
title: Test timer cleanup and unmount behavior
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-BDY-iVAs'
created: '2026-04-02T02:16:47.928Z'
updated: '2026-04-02T02:16:47.932Z'
sortIndex: 632
parent: task-BDY-iVAs
dependsOn:
  - task-B7yICiZl
---
After Fry's fix, verify: (1) Navigate away mid-ingestion and confirm no 'setState on unmounted component' warnings in the console. (2) Confirm ingestion polling stops when navigating away (check network tab — no continued `/api/knowledge/status` requests). (3) Confirm successful ingestion completes cleanly — status updates once, no duplicate state flips. (4) Confirm the 120s max timeout still works as a safety net if polling never returns success. (5) Rapidly trigger ingest → navigate away → return → ingest again and confirm no stale timers interfere. Write or update tests if a test file exists for this component.
