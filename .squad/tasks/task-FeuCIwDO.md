---
id: task-FeuCIwDO
title: Add test coverage for special character handling
status: pending
priority: P1
assignee: zoidberg
labels:
  - testing
  - security
  - xss
  - 'parent:task-F50-qNqa'
created: '2026-03-31T08:10:43.687Z'
updated: '2026-03-31T08:10:43.687Z'
sortIndex: 280
---
Write unit and E2E tests that create, read, update, and delete tasks with special characters in titles and descriptions — including HTML tags like <script>, double quotes, single quotes/apostrophes, and ampersands. Verify no XSS execution and correct round-trip persistence.
