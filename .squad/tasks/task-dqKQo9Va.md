---
id: task-dqKQo9Va
title: Add error feedback on server-side message parse failures
status: pending
priority: P0
assignee: bender
labels:
  - bug
  - websocket
  - error-handling
  - 'parent:task-GPxctKEl'
created: '2026-03-26T14:47:32.506Z'
updated: '2026-03-30T08:33:24.907Z'
sortIndex: 186
---
In `/apps/api/src/routes/terminal.ts:71-86` and `/apps/api/src/routes/sandboxes.ts:201-229`, JSON parse errors are silently swallowed. The client gets no feedback, making the connection appear frozen/stuck. Send an error frame back to the client on parse failure, and add proper logging so we can debug these in production.
