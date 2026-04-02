---
id: task-G1XGLqiU
title: Test file upload validation and debounced search
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-DylQFu5h'
created: '2026-04-02T02:07:01.535Z'
updated: '2026-04-02T02:07:01.539Z'
sortIndex: 611
parent: task-DylQFu5h
dependsOn:
  - task-K3XZEWuJ
  - task-fxRNGsoi
---
Write or update tests covering both changes:

**File upload validation tests** (for attachment handler):
- Accepting a file under 10MB with an allowed MIME type succeeds.
- Rejecting a file over 10MB shows an appropriate error.
- Rejecting a file with a disallowed MIME type shows an appropriate error.
- Edge case: exactly 10MB file is accepted.

**Debounce search tests** (for trace-detail, trace-list, memory-search, task-filters-toolbar):
- Typing rapidly only triggers the filter/search callback once after 300ms of inactivity (use fake timers).
- The displayed input value updates immediately on each keystroke.
- Clearing the input resets the search results promptly.

Use the existing test framework (Vitest). Run `pnpm test` to confirm all tests pass.
