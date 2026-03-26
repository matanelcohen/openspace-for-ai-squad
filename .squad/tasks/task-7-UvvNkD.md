---
id: task-7-UvvNkD
title: Surface reconnection state to user in terminal UI
status: pending-approval
priority: P1
assignee: fry
labels:
  - bug
  - ux
  - terminal
  - 'parent:task-GPxctKEl'
created: '2026-03-26T14:47:32.535Z'
updated: '2026-03-26T14:47:32.535Z'
sortIndex: 187
---
The terminal component (`/apps/web/src/components/terminal/terminal.tsx`) needs a visible connection status indicator. Show 'Reconnecting...' with attempt count, and a manual 'Retry' button after max retries are exhausted. Replace magic number `readyState === 1` with `WebSocket.OPEN` for clarity. Ensure the UI doesn't get stuck in a 'reconnecting' state with no way out.
