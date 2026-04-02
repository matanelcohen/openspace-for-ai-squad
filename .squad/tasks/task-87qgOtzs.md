---
id: task-87qgOtzs
title: Test cache cap and scroll behavior
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-DzQjhtJd'
created: '2026-04-02T02:17:39.844Z'
updated: '2026-04-02T02:17:39.846Z'
sortIndex: 634
parent: task-DzQjhtJd
dependsOn:
  - task-v4PjbjY0
---
Write tests verifying: (1) the setQueryData callback in use-chat never allows the cache to exceed MAX_CACHED_MESSAGES (500) — simulate receiving 600+ messages and assert the array length stays at 500 with the newest messages retained, (2) the sort is not called unnecessarily when messages arrive in order, (3) virtual scrolling renders only a subset of DOM nodes even with 500 cached messages, (4) scrolling to the top triggers a pagination fetch for older messages. Use the existing test framework (vitest + react-testing-library or playwright for e2e).
