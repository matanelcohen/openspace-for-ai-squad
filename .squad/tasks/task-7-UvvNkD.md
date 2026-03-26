---
id: task-7-UvvNkD
title: Surface reconnection state to user in terminal UI
status: done
priority: P1
assignee: fry
labels:
  - bug
  - ux
  - terminal
  - 'parent:task-GPxctKEl'
created: '2026-03-26T14:47:32.535Z'
updated: '2026-03-26T22:22:06.151Z'
sortIndex: 187
---
The terminal component (`/apps/web/src/components/terminal/terminal.tsx`) needs a visible connection status indicator. Show 'Reconnecting...' with attempt count, and a manual 'Retry' button after max retries are exhausted. Replace magic number `readyState === 1` with `WebSocket.OPEN` for clarity. Ensure the UI doesn't get stuck in a 'reconnecting' state with no way out.

---
**[2026-03-26 22:22:06]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-26 22:19:49]** 🧠 Thinking: Let me start by exploring the codebase to understand the current state of the terminal component and related files.
**[2026-03-26 22:19:49]** 🔧 Using tool: `unknown`
**[2026-03-26 22:19:49]** 🔧 Using tool: `unknown`
**[2026-03-26 22:19:49]** 🔧 Using tool: `unknown`
**[2026-03-26 22:19:53]** 🔧 Using tool: `unknown`
**[2026-03-26 22:20:00]** 🧠 Thinking: Now I understand the current state. Let me analyze what needs to be done:

1. **Show 'Reconnecting...' with attempt count** — Currently it shows "Disc
**[2026-03-26 22:20:00]** 🔧 Using tool: `unknown`
**[2026-03-26 22:20:00]** 🔧 Using tool: `unknown`
**[2026-03-26 22:20:12]** 🧠 Thinking: The `readyState === 1` magic numbers are in the API/backend files, not in the terminal component itself (which already uses `WebSocket.OPEN`). But the
**[2026-03-26 22:20:12]** 🔧 Using tool: `unknown`
**[2026-03-26 22:20:18]** 🔧 Using tool: `unknown`
**[2026-03-26 22:20:23]** 🔧 Using tool: `unknown`
**[2026-03-26 22:20:28]** 🔧 Using tool: `unknown`
**[2026-03-26 22:20:34]** 🔧 Using tool: `unknown`
**[2026-03-26 22:20:44]** 🔧 Using tool: `unknown`
**[2026-03-26 22:20:48]** 🔧 Using tool: `unknown`
**[2026-03-26 22:20:52]** 🔧 Using tool: `unknown`
**[2026-03-26 22:20:55]** 🔧 Using tool: `unknown`
**[2026-03-26 22:21:01]** 🧠 Thinking: The backend uses Fastify with its WebSocket support. The `socket` there is likely a `ws` library WebSocket. The `ws` library does export `WebSocket.OP
**[2026-03-26 22:21:01]** 🔧 Using tool: `unknown`
**[2026-03-26 22:21:07]** 🔧 Using tool: `unknown`
**[2026-03-26 22:21:12]** 🔧 Using tool: `unknown`
**[2026-03-26 22:21:17]** 🔧 Using tool: `unknown`
**[2026-03-26 22:21:17]** 🔧 Using tool: `unknown`
**[2026-03-26 22:21:21]** 🔧 Using tool: `unknown`
**[2026-03-26 22:21:21]** 🔧 Using tool: `unknown`
**[2026-03-26 22:21:30]** 🔧 Using tool: `unknown`
**[2026-03-26 22:21:38]** 🔧 Using tool: `unknown`
**[2026-03-26 22:21:46]** 🧠 Thinking: There's a potential issue here: `scheduleReconnect` is used inside `connect` but `connect` doesn't list it in its dependency array, and `scheduleRecon
**[2026-03-26 22:21:46]** 🔧 Using tool: `unknown`
**[2026-03-26 22:21:54]** 🔧 Using tool: `unknown`

**[2026-03-26 22:22:06]** ✅ Fry completed this task.

**Result:**
Committed and lint/prettier passed ✅

**Summary of changes:**

1. **`terminal.tsx`** — Added reconnection state tracking:
   - New `MAX_RECONNECT_ATTEMPTS = 5` constant
   - New `'reconnecting'` and `'failed'` status states (replaced `'disconnected'`)
   - Status bar shows `Reconnecting… (attempt 2/5)` with pulsing yellow dot
   - After 5 failed attempts → red dot + "Connection failed" + **Retry** button
   - Retry resets counters and reconnects fresh

2. **`terminal.ts`** (backend) — Replaced `readyState === 1` magic numbers with `WebSocket.OPEN` via proper `ws` import
