---
id: task-eSuFp_zR
title: Improve terminal page error UX when PTY is unavailable
status: pending
priority: P1
assignee: fry
labels:
  - bug
  - frontend
  - UX
  - error-handling
  - 'parent:task-PRYrQNNq'
created: '2026-03-30T09:05:39.864Z'
updated: '2026-03-30T09:05:39.864Z'
sortIndex: 214
---
Currently when PTY spawn fails, the frontend enters a reconnect loop (5 attempts with exponential backoff) then shows a generic 'Connection failed' message. Improve the UX in apps/web/src/components/terminal/terminal.tsx: (1) detect PTY-specific errors from the WebSocket error message and show a clear explanation, (2) show a fallback UI instead of a blank terminal when the backend is unavailable, (3) consider disabling the retry loop when the error is a spawn failure (not a transient network issue).
