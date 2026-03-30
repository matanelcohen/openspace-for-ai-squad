---
id: task-ECEUbJ1A
title: End-to-end terminal regression tests
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-_U_Q7gHO'
created: '2026-03-30T11:51:53.950Z'
updated: '2026-03-30T11:51:53.950Z'
sortIndex: 223
parent: task-_U_Q7gHO
---
Write and run tests covering: (1) terminal session opens and receives shell output, (2) PTY process is cleaned up on WebSocket disconnect (verify no orphaned processes), (3) rapid connect/disconnect cycles don't leak resources, (4) sidebar navigation between terminal and other pages doesn't break WebSocket state, (5) terminal works after a full page reload. Use the existing Playwright/Vitest setup.
