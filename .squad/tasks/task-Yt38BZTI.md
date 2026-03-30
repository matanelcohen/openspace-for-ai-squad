---
id: task-Yt38BZTI
title: Write terminal E2E and unit tests
status: blocked
priority: P0
assignee: zoidberg
labels:
  - 'parent:task-sKDRWFwZ'
created: '2026-03-30T11:48:59.171Z'
updated: '2026-03-30T12:01:19.403Z'
sortIndex: 220
parent: task-sKDRWFwZ
---
Create comprehensive tests for the terminal feature:
1. Unit tests for terminal.tsx reconnection logic — mock WebSocket, verify: initial connect, onerror triggers reconnect, exponential backoff timing, max attempts shows 'failed' state, retry button resets attempts
2. Unit tests for useSandboxStream reconnection (after Fry adds it)
3. E2E test with Playwright (config at /playwright.config.ts): navigate to /terminal page, verify terminal loads and shows connected status, type a command and verify output, simulate server disconnect and verify reconnection UI appears
4. Backend test for /apps/api/src/routes/terminal.ts: WebSocket connects, PTY spawns, input/output works, resize works, graceful cleanup on close
5. Existing test reference: /apps/web/src/hooks/__tests__/websocket-resilience.test.ts has exponential backoff patterns to follow

---
**[2026-03-30 11:48:59]** 🚀 Zoidberg started working on this task.
**[2026-03-30 11:48:59]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:49:53]** 🚀 Zoidberg started working on this task.
**[2026-03-30 11:49:53]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:51:38]** 🚀 Zoidberg started working on this task.
**[2026-03-30 11:51:38]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:54:38]** 🚀 Zoidberg started working on this task.
**[2026-03-30 11:54:38]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:56:40]** 🚀 Zoidberg started working on this task.
**[2026-03-30 11:56:40]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 12:01:19]** 🛑 Permanently blocked after 5 failed attempts.
