---
id: task-5aGCRfQV
title: Add reconnection logic to useSandboxStream hook
status: pending-approval
priority: P0
assignee: fry
labels:
  - bug
  - websocket
  - terminal
  - 'parent:task-GPxctKEl'
created: '2026-03-26T14:47:32.479Z'
updated: '2026-03-26T14:47:32.479Z'
sortIndex: 185
---
The `useSandboxStream` hook in `/apps/web/src/hooks/use-sandbox-stream.ts` has NO reconnection logic — when the WebSocket closes (line 71-73), it stays dead. Copy the exponential backoff pattern from `useWebSocket` (1s initial → 2x backoff → 30s max). Also add a max retry limit (e.g., 10 attempts) to avoid infinite loops. This is the most likely cause of 'stuck on reconnecting'.
