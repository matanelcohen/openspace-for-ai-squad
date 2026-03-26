---
id: task-hDnxwG9E
title: Write tests for terminal WebSocket endpoint and UI
status: pending-approval
priority: P1
assignee: zoidberg
labels:
  - testing
  - terminal
  - unit-test
  - e2e
  - 'parent:task-hhMHoacH'
created: '2026-03-26T14:32:45.255Z'
updated: '2026-03-26T14:32:45.255Z'
sortIndex: 183
---
Write unit tests for the backend terminal route: test PTY spawn on WebSocket connect, input/output message forwarding, resize handling, and cleanup on disconnect. Write frontend component tests for the Terminal component: verify xterm mounts, WebSocket connection is established, and resize events are sent. Add an E2E test in the e2e/ folder that navigates to /terminal, verifies the terminal renders, types a command (e.g., `echo hello`), and verifies output appears.
