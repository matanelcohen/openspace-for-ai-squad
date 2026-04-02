---
id: task-oeEpKAzp
title: Add tests for path traversal prevention
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-4-4u7j2L'
created: '2026-04-02T10:37:49.069Z'
updated: '2026-04-02T10:37:49.072Z'
sortIndex: 39
parent: task-4-4u7j2L
dependsOn:
  - task-L37IGiPz
---
Write tests for the workspace file read endpoint to verify the path traversal guard works correctly. Test cases: (1) Normal file read within workspace succeeds. (2) Request with '../' in filename returns 400/403. (3) Request with '../../etc/passwd' is blocked. (4) Request with URL-encoded traversal ('%2e%2e%2f') is blocked if applicable. (5) Absolute path injection (e.g. '/etc/passwd') is blocked. (6) Nested traversal like 'subdir/../../outside' is blocked. Use the existing test framework (vitest). Place tests alongside existing workspace route tests.
