---
id: task-CGlbMlaK
title: Write unit and integration tests for channel hooks
status: blocked
priority: P1
assignee: zoidberg
labels:
  - testing
  - unit-tests
  - integration-tests
  - hooks
  - 'parent:task-eLmi8eT_'
created: '2026-03-25T15:03:32.053Z'
updated: '2026-03-25T16:46:19.303Z'
sortIndex: 86
---
Write tests for all four hooks (useChannels, useChannel, useCreateChannel, useUpdateChannel). Test: successful data fetching, error handling, optimistic update behavior and rollback, cache invalidation after mutations, and WebSocket-triggered cache updates. Use MSW or similar to mock REST endpoints and a mock WebSocket server for real-time events. Aim for full coverage of happy paths and edge cases.

---
**[2026-03-25 16:40:30]** 🚀 Zoidberg started working on this task.

---
**[2026-03-25 16:43:08]** 🚀 Zoidberg started working on this task.

---
**[2026-03-25 16:46:19]** 🚀 Zoidberg started working on this task.

---
**[2026-03-25 16:46:19]** ❌ **BLOCKED** — zoidberg failed.

**Error:** Request session.create failed with message: fetch failed

**Stack:** ```
Error: Request session.create failed with message: fetch failed
    at handleResponse (/Users/matancohen/microsoft/openspace-for-ai-squad/node_modules/.pnpm/vscode-jsonrpc@8.2.1/node_modules/vscode-jsonrpc/lib/common/connection.js:565:48)
    at handleMessage (/Users/matancohen/microsoft/openspace-f
```
