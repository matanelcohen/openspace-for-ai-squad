---
id: task-AfKZONt4
title: Add PTY WebSocket endpoint to API
status: done
priority: P0
assignee: bender
labels:
  - backend
  - websocket
  - terminal
  - new-feature
  - 'parent:task-hhMHoacH'
created: '2026-03-26T14:32:45.182Z'
updated: '2026-03-31T21:51:05.014Z'
sortIndex: 124
---
Install `node-pty` in apps/api. Create a new route file `apps/api/src/routes/terminal.ts` that registers a WebSocket endpoint at `/api/terminal/ws`. On connection, spawn a PTY process (default: bash) using node-pty. Pipe PTY stdout to WebSocket messages (type 'output') and WebSocket input messages (type 'input') to PTY stdin. Handle resize messages (type 'resize' with cols/rows) by calling pty.resize(). Clean up the PTY process on WebSocket close. Register the route in `apps/api/src/app.ts`.

---
**[2026-03-26 14:34:39]** 🚀 Bender started working on this task.

---
**[2026-03-26 14:35:54]** 🚀 Bender started working on this task.

---
**[2026-03-26 14:37:09]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-26 14:36:31]** 🧠 Thinking: Let me understand the task: I need to add a PTY WebSocket endpoint to the API app. Let me explore the codebase first to understand the structure.
**[2026-03-26 14:36:31]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:31]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:31]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:31]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:37]** 🧠 Thinking: I can see that `node-pty` is already in the dependencies and `terminalRoute` is already imported and registered in app.ts. Let me check if the termina
**[2026-03-26 14:36:37]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:41]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:46]** 🧠 Thinking: The file already exists and looks complete. Let me verify the route is properly registered in app.ts and that node-pty is installed.
**[2026-03-26 14:36:46]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:46]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:54]** 🔧 Using tool: `unknown`

**[2026-03-26 14:37:09]** ✅ Bender completed this task.

**Result:**
Everything's already in place. Here's what exists:

- **`apps/api/src/routes/terminal.ts`** — WebSocket endpoint at `/api/terminal/ws` that:
  - Spawns a PTY via `node-pty` (default: `$SHELL` or `bash`)
  - Pipes PTY stdout → WebSocket as `{type: "output", data}` messages
  - Handles `{type: "input", data}` → PTY stdin
  - Handles `{type: "resize", cols, rows}` → `pty.resize()`
  - Kills PTY on WebSocket close, closes WebSocket on PTY exit
- **`apps/api/package.json`** — `node-pty@^1.1.0` already listed
- **`apps/api/src/app.ts`** — Route imported and registered at `prefix: '/api'`

This task is already done. No changes needed.
