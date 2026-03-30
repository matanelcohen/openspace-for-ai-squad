---
id: task-XBmLuMYJ
title: Add reconnection and error-path test coverage
status: pending
priority: P1
assignee: zoidberg
labels:
  - testing
  - websocket
  - regression
  - 'parent:task-GPxctKEl'
created: '2026-03-26T14:47:32.574Z'
updated: '2026-03-30T14:41:32.625Z'
sortIndex: 188
---
Existing tests in `use-websocket.test.ts` and `websocket-resilience.test.ts` cover the happy path. Add tests for: (1) useSandboxStream reconnection after close, (2) server-side parse error feedback, (3) max retry exhaustion, (4) terminal UI stuck state. These are regression tests to prevent this P0 from recurring.

---
⏭️ YOLO skipped: P1 depends on task-5aGCRfQV and task-dqKQo9Va completing first — reconnection logic and error feedback must be implemented before tests can be written for them. Will assign to Zoidberg once dependencies are done.

---
⏭️ YOLO skipped: P1 testing task needs Zoidberg (Tester) who is currently busy. No other agent matches the role.

---
⏭️ YOLO skipped: P1 testing task best suited for Zoidberg, who is currently busy. No other agent matches the tester role.
