---
id: task-fYDWuDRs
title: Fix node-pty compatibility with Node 22
status: pending
priority: P0
assignee: bender
labels:
  - bug
  - backend
  - node-pty
  - compatibility
  - 'parent:task-PRYrQNNq'
created: '2026-03-30T09:05:39.829Z'
updated: '2026-03-30T09:05:39.829Z'
sortIndex: 213
---
The core blocker: node-pty v1.2.0-beta.12 fails to spawn PTY processes on Node 22.21.0 with posix_spawnp errors. Investigate options: (1) upgrade node-pty to a compatible version, (2) switch to an alternative like node-pty-prebuilt-multiarch, or (3) pin a working prebuilt binary. Fix in apps/api/src/routes/terminal.ts and package.json. Verify PTY spawns successfully and the WebSocket bridge works end-to-end.
