---
id: task-TpZQ-5MQ
title: Sanitize and validate special characters in backend API inputs
status: pending
priority: P1
assignee: bender
labels:
  - security
  - backend
  - validation
  - 'parent:task-F50-qNqa'
created: '2026-03-31T08:10:41.941Z'
updated: '2026-03-31T08:10:41.941Z'
sortIndex: 279
---
Ensure the backend API properly handles task titles and descriptions containing special characters (<, >, &, ", '). Validate that these are stored correctly in the database without corruption or truncation, and that API responses encode them safely (e.g., proper JSON escaping).
