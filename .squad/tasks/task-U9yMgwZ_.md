---
id: task-U9yMgwZ_
title: Add file upload validation to Knowledge page attachment handler
status: in-progress
priority: P1
assignee: fry
labels:
  - 'parent:task-DylQFu5h'
created: '2026-04-02T01:42:41.137Z'
updated: '2026-04-02T01:42:41.137Z'
sortIndex: 584
parent: task-DylQFu5h
---
In attachment.tsx (lines 30-63), add file validation before creating Object URLs. Define MAX_FILE_SIZE = 10 * 1024 * 1024 (10MB) and ALLOWED_TYPES array (e.g. 'application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'text/markdown'). Before the Object URL creation, check file.size <= MAX_FILE_SIZE and ALLOWED_TYPES.includes(file.type). Show a toast/error message if validation fails. Revoke Object URLs when no longer needed to prevent memory leaks.
