---
id: task-zaxInXWn
title: Add DELETE route tests to chat.test.ts
status: done
priority: P1
assignee: zoidberg
labels:
  - testing
  - api
  - regression
  - 'parent:task-BPi8Kq1D'
created: '2026-03-25T14:02:52.679Z'
updated: '2026-03-25T14:46:36.866Z'
sortIndex: 64
---
The existing chat.test.ts (apps/api/src/routes/chat.test.ts) has no test coverage for the DELETE /api/chat/messages endpoint. Add tests covering: (1) DELETE with no filters clears all messages, (2) DELETE with ?agent=fry clears only fry-related messages, (3) DELETE with Content-Type: application/json and no body still works (regression test for the 400 bug). Seed messages in beforeEach and verify counts after deletion.
