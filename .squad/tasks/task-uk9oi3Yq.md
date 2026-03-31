---
id: task-uk9oi3Yq
title: Add tests for clear chat functionality
status: done
priority: P1
assignee: zoidberg
labels:
  - testing
  - unit-tests
  - e2e
  - chat
  - 'parent:task-meNX3cL6'
created: '2026-03-25T13:45:36.792Z'
updated: '2026-03-31T21:51:04.790Z'
sortIndex: 65
---
Add unit tests for the DELETE endpoint in the API (Vitest) verifying: messages are removed from SQLite, markdown files are cleaned up, query param filtering works, and empty state is handled. Add frontend tests (React Testing Library) for: the clear button renders, confirmation dialog appears on click, useClearChat hook calls the API and invalidates cache. Add a Playwright E2E test in e2e/ that sends messages then clears them and verifies the chat is empty.
