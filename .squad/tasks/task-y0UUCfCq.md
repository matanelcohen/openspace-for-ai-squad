---
id: task-y0UUCfCq
title: Add terminal integration and unit tests
status: pending
priority: P1
assignee: zoidberg
labels:
  - testing
  - terminal
  - unit-test
  - e2e
  - 'parent:task-PRYrQNNq'
created: '2026-03-30T09:05:39.964Z'
updated: '2026-03-30T09:05:39.964Z'
sortIndex: 215
---
The terminal has no integration tests. Add: (1) unit tests for the WebSocket message protocol (input, resize, output, error message types) in the backend route, (2) unit tests for the frontend terminal component covering connection states (connected, reconnecting, failed), (3) an E2E test that opens /terminal, verifies the xterm.js container renders, connects via WebSocket, sends input, and receives output. Test files: apps/api and apps/web test dirs, plus e2e/.
