---
id: task-v4U-tLWK
title: Fix frontend terminal reconnection logic
status: blocked
priority: P0
assignee: fry
labels:
  - 'parent:task-sKDRWFwZ'
created: '2026-03-30T11:48:58.141Z'
updated: '2026-03-30T12:01:19.402Z'
sortIndex: 219
parent: task-sKDRWFwZ
---
Fix reconnection issues in the terminal frontend:
1. In /apps/web/src/components/terminal/terminal.tsx — verify the onerror→ws.close() fix (commit 2443cd5) is working. Test that exponential backoff reconnection (2s→4s→8s→16s→30s, max 5 attempts) actually re-establishes the connection.
2. In /apps/web/src/hooks/use-sandbox-stream.ts (lines 71-73) — the WebSocket onclose handler just calls setIsStreaming(false) with NO reconnection logic. Add exponential backoff reconnection matching the pattern in terminal.tsx (initial 1s, 2x factor, 30s max, 10 max attempts).
3. Check the WebSocket URL construction in terminal.tsx (lines 11-21) — ensure NEXT_PUBLIC_WS_URL and NEXT_PUBLIC_API_URL produce correct ws:// URLs, especially in the single-port architecture (commit 3662ee7).
4. Add a visible error message when the backend is unreachable (not just 'Reconnecting...').

---
**[2026-03-30 11:48:58]** 🚀 Fry started working on this task.
**[2026-03-30 11:48:58]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:49:53]** 🚀 Fry started working on this task.
**[2026-03-30 11:49:53]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:51:38]** 🚀 Fry started working on this task.
**[2026-03-30 11:51:38]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:54:38]** 🚀 Fry started working on this task.
**[2026-03-30 11:54:38]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 11:56:40]** 🚀 Fry started working on this task.
**[2026-03-30 11:56:40]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-03-30 12:01:19]** 🛑 Permanently blocked after 5 failed attempts.
