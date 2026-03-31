---
id: task-7QU0jzOS
title: Create interactive terminal page with xterm.js
status: done
priority: P0
assignee: fry
labels:
  - frontend
  - terminal
  - new-page
  - xterm
  - 'parent:task-hhMHoacH'
created: '2026-03-26T14:32:45.208Z'
updated: '2026-03-31T21:51:05.013Z'
sortIndex: 125
---
Install `@xterm/xterm` and `@xterm/addon-fit` in apps/web. Create a new Next.js page at `apps/web/app/terminal/page.tsx`. Build a `<Terminal>` component in `apps/web/src/components/terminal/terminal.tsx` that: (1) renders an xterm.js instance in a full-height container, (2) connects to the backend PTY WebSocket at `ws://<API_HOST>/api/terminal/ws` using the existing API URL config, (3) pipes xterm input to WebSocket and WebSocket output to xterm, (4) uses the fit addon to auto-resize and sends resize events to the backend, (5) handles reconnection on disconnect. Style with Tailwind to match the existing dark theme. Add a nav link to the terminal page in the sidebar/navigation component.

---
**[2026-03-26 14:34:40]** 🚀 Fry started working on this task.

---
**[2026-03-26 14:35:54]** 🚀 Fry started working on this task.

---
**[2026-03-26 14:38:40]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-26 14:36:29]** 🧠 Thinking: Let me start by exploring the codebase to understand the project structure, existing patterns, and configuration before implementing the terminal page
**[2026-03-26 14:36:29]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:29]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:29]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:29]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:33]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:33]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:33]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:33]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:37]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:37]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:37]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:41]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:41]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:47]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:47]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:47]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:54]** 🧠 Thinking: Now I have a good understanding of the codebase. Let me look at a few more things - the WebSocket provider and an existing page to understand patterns
**[2026-03-26 14:36:54]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:54]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:54]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:58]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:58]** 🔧 Using tool: `unknown`
**[2026-03-26 14:36:58]** 🔧 Using tool: `unknown`
**[2026-03-26 14:37:03]** 🔧 Using tool: `unknown`
**[2026-03-26 14:37:18]** 🔧 Using tool: `unknown`
**[2026-03-26 14:37:49]** 🔧 Using tool: `unknown`
**[2026-03-26 14:37:49]** 🔧 Using tool: `unknown`
**[2026-03-26 14:37:49]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/terminal/terminal.tsx
**[2026-03-26 14:37:49]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/app/terminal/page.tsx
**[2026-03-26 14:37:55]** 🔧 Using tool: `unknown`
**[2026-03-26 14:38:01]** 🔧 Using tool: `unknown`
**[2026-03-26 14:38:05]** 🔧 Using tool: `unknown`
**[2026-03-26 14:38:05]** 🔧 Using tool: `unknown`
**[2026-03-26 14:38:23]** 🔧 Using tool: `unknown`
**[2026-03-26 14:38:30]** 🔧 Using tool: `unknown`

**[2026-03-26 14:38:40]** ✅ Fry completed this task.

**Result:**
Everything looks great. Here's what I built:

**New files:**
- **`apps/web/src/components/terminal/terminal.tsx`** — Full `<Terminal>` component using `@xterm/xterm` + `@xterm/addon-fit`. Features:
  - Dark theme matching the app's color scheme
  - WebSocket connection to `ws://<API_HOST>/api/terminal/ws` (auto-detects from `NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_WS_URL`)
  - Pipes xterm input → WebSocket (`{ type: "input", data }`) and WebSocket output → xterm
  - FitAddon with `ResizeObserver` + window resize listener for auto-sizing; sends `{ type: "resize", cols, rows }` events
  - Exponential backoff reconnection (2s → 30s max)
  - Connection status indicator (green/yellow/red dot)

- **`apps/web/app/terminal/page.tsx`** — Next.js page with `dynamic()` import (SSR disabled since xterm needs DOM)

**Modified:**
- **`apps/web/src/components/layout/sidebar.tsx`** — Added `SquareTerminal` icon and `/terminal` nav link
- **`apps/web/package.json`** — Added `@xterm/xterm` and `@xterm/addon-fit` dependencies

Zero new type errors ✅
