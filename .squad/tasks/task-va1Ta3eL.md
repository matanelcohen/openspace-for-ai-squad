---
id: task-va1Ta3eL
title: Build sandbox UI panel and terminal output viewer
status: done
priority: P2
assignee: fry
labels:
  - frontend
  - UI
  - sandbox
  - terminal
  - 'parent:task-RpGqbXvk'
created: '2026-03-25T23:19:27.934Z'
updated: '2026-03-31T21:51:04.864Z'
sortIndex: 100
---
Create the frontend components for agents to interact with sandboxes: a sandbox panel showing active containers and their status, a terminal-style output viewer with ANSI color support for streaming build/test output, runtime selector (Node/Python/Go), and controls to run commands, stop execution, and destroy sandboxes. Integrate with the WebSocket streaming endpoint for real-time output.

---
**[2026-03-26 00:44:37]** 🚀 Fry started working on this task.

---
**[2026-03-26 00:47:01]** 🚀 Fry started working on this task.

---
**[2026-03-26 00:56:57]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-26 00:49:49]** 🧠 Thinking: Let me understand the task: I need to build frontend components for a sandbox UI panel and terminal output viewer. Let me first explore the codebase t
**[2026-03-26 00:49:49]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:49]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:55]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:55]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:55]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:49:59]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:03]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:07]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:07]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:07]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:15]** 🧠 Thinking: This is great! I can see the project structure. Let me explore more deeply - there's already an `ansi-parser.ts` in lib, and a `use-websocket.ts` hook
**[2026-03-26 00:50:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:15]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:21]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:21]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:21]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:21]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:21]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:22]** 🧠 Thinking: Now I have a great understanding of the codebase. Let me look at a few more things to understand the component patterns and existing API patterns.
**[2026-03-26 00:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:22]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:28]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:28]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:32]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:32]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:35]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:35]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:35]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:35]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:35]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:36]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:36]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:40]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:45]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:45]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:45]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:45]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:45]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:51]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:53]** 🧠 Thinking: Excellent! Now I have a very thorough understanding of the codebase:

1. **Monorepo**: pnpm + turbo, apps/web (Next.js + React), apps/api (Express/Hon
**[2026-03-26 00:50:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:53]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:57]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:57]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:50:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:51:01]** 🔧 Using tool: `unknown`
**[2026-03-26 00:51:02]** 🔧 Using tool: `unknown`
**[2026-03-26 00:51:02]** 🔧 Using tool: `unknown`
**[2026-03-26 00:51:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:51:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:51:52]** 🔧 Using tool: `unknown`
**[2026-03-26 00:51:53]** ℹ️ /Users/matancohen/.copilot/session-state/08c28b90-59eb-462d-b009-598ca85747a5/plan.md
**[2026-03-26 00:51:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:51:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:51:58]** 🔧 Using tool: `unknown`
**[2026-03-26 00:52:02]** 🔧 Using tool: `unknown`
**[2026-03-26 00:52:10]** 🧠 Thinking: Good, the explore agent confirmed everything I already learned. Let me now build all the components. I'll create them in parallel where possible.

Let
**[2026-03-26 00:52:10]** 🔧 Using tool: `unknown`
**[2026-03-26 00:53:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:53:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:53:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:53:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:53:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:53:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:53:08]** 🔧 Using tool: `unknown`
**[2026-03-26 00:53:08]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/use-sandbox-stream.ts
**[2026-03-26 00:53:08]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/hooks/use-sandboxes.ts
**[2026-03-26 00:53:08]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/ansi-line.tsx
**[2026-03-26 00:53:08]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/runtime-selector.tsx
**[2026-03-26 00:53:08]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/command-input.tsx
**[2026-03-26 00:53:08]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/sandbox-controls.tsx
**[2026-03-26 00:53:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:53:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:53:46]** 🔧 Using tool: `unknown`
**[2026-03-26 00:53:46]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/terminal-output.tsx
**[2026-03-26 00:53:46]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/sandbox-list.tsx
**[2026-03-26 00:53:46]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/sandbox-card.tsx
**[2026-03-26 00:54:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:54:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:54:13]** 🔧 Using tool: `unknown`
**[2026-03-26 00:54:13]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/sandbox-panel.tsx
**[2026-03-26 00:54:13]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/index.ts
**[2026-03-26 00:54:19]** 🔧 Using tool: `unknown`
**[2026-03-26 00:54:19]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/app/sandboxes/page.tsx
**[2026-03-26 00:54:23]** 🔧 Using tool: `unknown`
**[2026-03-26 00:54:23]** 🔧 Using tool: `unknown`
**[2026-03-26 00:54:27]** 🔧 Using tool: `unknown`
**[2026-03-26 00:54:27]** 🔧 Using tool: `unknown`
**[2026-03-26 00:54:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:54:34]** 🔧 Using tool: `unknown`
**[2026-03-26 00:54:38]** 🔧 Using tool: `unknown`
**[2026-03-26 00:54:43]** 🔧 Using tool: `unknown`
**[2026-03-26 00:55:24]** 🔧 Using tool: `unknown`
**[2026-03-26 00:55:24]** 🔧 Using tool: `unknown`
**[2026-03-26 00:55:24]** 🔧 Using tool: `unknown`
**[2026-03-26 00:55:24]** 🔧 Using tool: `unknown`
**[2026-03-26 00:55:24]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/__tests__/ansi-line.test.tsx
**[2026-03-26 00:55:24]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/__tests__/command-input.test.tsx
**[2026-03-26 00:55:24]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/__tests__/sandbox-card.test.tsx
**[2026-03-26 00:55:24]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/sandbox/__tests__/terminal-output.test.tsx
**[2026-03-26 00:55:29]** 🔧 Using tool: `unknown`
**[2026-03-26 00:55:29]** 🔧 Using tool: `unknown`
**[2026-03-26 00:55:36]** 🔧 Using tool: `unknown`
**[2026-03-26 00:55:47]** 🔧 Using tool: `unknown`
**[2026-03-26 00:55:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:55:56]** 🔧 Using tool: `unknown`
**[2026-03-26 00:56:02]** 🔧 Using tool: `unknown`
**[2026-03-26 00:56:09]** 🔧 Using tool: `unknown`
**[2026-03-26 00:56:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:56:17]** 🔧 Using tool: `unknown`
**[2026-03-26 00:56:24]** 🔧 Using tool: `unknown`
**[2026-03-26 00:56:31]** 🔧 Using tool: `unknown`
**[2026-03-26 00:56:42]** 🔧 Using tool: `unknown`

**[2026-03-26 00:56:57]** ✅ Fry completed this task.

**Result:**
Committed! ESLint + Prettier passed via husky pre-commit hook. Here's a summary:

## ✅ Done — Sandbox UI Panel & Terminal Output Viewer

**17 files, 1,380 lines added, 34 tests passing.**

### What I built:

| Component | Purpose |
|---|---|
| **SandboxPanel** | Main split-pane layout: sandbox list sidebar + terminal viewer |
| **TerminalOutput** | Dark terminal viewer with ANSI colors, auto-scroll, streaming indicator, blinking cursor |
| **AnsiLine** | Memoized ANSI→React renderer using existing `parseAnsi()` |
| **SandboxCard** | Status dot, runtime badge, CPU/memory usage, agent info |
| **SandboxList** | Scrollable list with loading skeleton + empty state |
| **RuntimeSelector** | Node.js / Python / Go dropdown (Radix Select) |
| **CommandInput** | Terminal-style `$` prompt with ↑/↓ command history |
| **SandboxControls** | Run/Stop/Destroy buttons with tooltips |
| **useSandboxes** | React Query CRUD + WebSocket invalidation |
| **useSandboxStream** | Dedicated WebSocket for real-time output streaming |
| **ANSI CSS** | Full One Dark-themed terminal color classes |
| **`/sandboxes` page** | Next.js route at `app/sandboxes/page.tsx` |
