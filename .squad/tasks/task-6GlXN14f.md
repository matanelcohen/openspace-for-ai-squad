---
id: task-6GlXN14f
title: Add Clear Chat button to chat sidebar/header UI
status: done
priority: P0
assignee: fry
labels:
  - frontend
  - ui
  - chat
  - components
  - 'parent:task-meNX3cL6'
created: '2026-03-25T13:45:36.772Z'
updated: '2026-03-31T21:51:04.784Z'
sortIndex: 64
---
Add a 'Clear Chat' button to the chat UI in apps/web/src/components/chat/chat-sidebar.tsx (or chat-client.tsx header area). Use the existing shadcn Button component and a Radix AlertDialog for confirmation ('Are you sure? This will permanently delete all messages in this chat.'). Wire it to the useClearChat hook. Include a trash/eraser icon (lucide-react). Support clearing per-channel (current chat) and optionally an 'all chats' option via a dropdown menu.

---
**[2026-03-25 13:53:07]** 🚀 Fry started working on this task.

---
**[2026-03-25 14:08:17]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-25 13:54:09]** 🧠 Thinking: Let me start by exploring the codebase to understand the structure and find the relevant files mentioned in the task.
**[2026-03-25 13:54:09]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:09]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:14]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:14]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:14]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:14]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:18]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:23]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:23]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:23]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:23]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:23]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:23]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:23]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:23]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:27]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:27]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:32]** 🧠 Thinking: Now I have a good picture. Let me check:

1. There are two `useClearChat` functions in `use-chat.ts` — one takes `recipient` as a parameter (line 109)
**[2026-03-25 13:54:32]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:32]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:32]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:32]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:41]** 🧠 Thinking: I see that `@radix-ui/react-alert-dialog` is NOT installed. I need to either:
1. Install it and create the shadcn alert-dialog component
2. Use the ex
**[2026-03-25 13:54:41]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:41]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:41]** 🔧 Using tool: `unknown`
**[2026-03-25 13:54:41]** 🔧 Using tool: `unknown`
**[2026-03-25 13:55:20]** 🧠 Thinking: Now I have a clear picture. Let me plan the implementation:

1. **No `alert-dialog` component exists** — I need to create one or install the package. 
**[2026-03-25 13:55:20]** 🔧 Using tool: `unknown`
**[2026-03-25 13:55:20]** 🔧 Using tool: `unknown`
**[2026-03-25 13:55:20]** ℹ️ /Users/matancohen/.copilot/session-state/485dd30d-c8c3-495d-a6db-4340856bcf65/plan.md
**[2026-03-25 13:55:23]** 🔧 Using tool: `unknown`
**[2026-03-25 13:56:03]** 🧠 Thinking: Excellent! Now I have full context. Key findings:

1. **`chat-client.tsx`** already exists at `apps/web/app/chat/chat-client.tsx` — it already imports
**[2026-03-25 13:56:03]** 🔧 Using tool: `unknown`
**[2026-03-25 13:56:03]** 🔧 Using tool: `unknown`
**[2026-03-25 13:56:03]** 🔧 Using tool: `unknown`
**[2026-03-25 13:56:16]** 🧠 Thinking: Hmm, it seems like the package might not have been added. Let me check.

Actually, looking at the output more carefully: "resolved 944, reused 0, down
**[2026-03-25 13:56:16]** 🔧 Using tool: `unknown`
**[2026-03-25 13:56:34]** 🔧 Using tool: `unknown`
**[2026-03-25 13:56:34]** 🔧 Using tool: `unknown`
**[2026-03-25 13:56:34]** ℹ️ /Users/matancohen/microsoft/openspace-for-ai-squad/apps/web/src/components/ui/alert-dialog.tsx
**[2026-03-25 13:56:48]** 🔧 Using tool: `unknown`
**[2026-03-25 13:56:53]** 🔧 Using tool: `unknown`
**[2026-03-25 13:57:03]** 🧠 Thinking: It seems like there's only one `useClearChat` now (the explore agent may have seen an older version). The current one at line 109-127 takes no params 
**[2026-03-25 13:57:03]** 🔧 Using tool: `unknown`
**[2026-03-25 13:57:35]** 🔧 Using tool: `unknown`
**[2026-03-25 13:57:35]** 🔧 Using tool: `unknown`
**[2026-03-25 13:57:38]** 🔧 Using tool: `unknown`
**[2026-03-25 13:57:47]** 🧠 Thinking: I see that chat-client.tsx already has some Clear Chat wiring! It has:
- `showClearDialog` state
- `useClearChat()` hook call
- A "Clear" button in th
**[2026-03-25 13:57:47]** 🔧 Using tool: `unknown`
**[2026-03-25 13:57:53]** 🔧 Using tool: `unknown`
**[2026-03-25 13:57:53]** 🔧 Using tool: `unknown`
**[2026-03-25 13:58:16]** 🔧 Using tool: `unknown`
**[2026-03-25 13:58:21]** 🔧 Using tool: `unknown`
**[2026-03-25 13:58:21]** 🔧 Using tool: `unknown`
**[2026-03-25 13:58:21]** 🔧 Using tool: `unknown`
**[2026-03-25 13:58:33]** 🧠 Thinking: The test can't resolve the `@/` path alias. This is a pre-existing issue with the test runner config. Let me check how other tests work and if there's
**[2026-03-25 13:58:33]** 🔧 Using tool: `unknown`
**[2026-03-25 13:58:38]** 🔧 Using tool: `unknown`
**[2026-03-25 13:58:44]** 🔧 Using tool: `unknown`
**[2026-03-25 13:59:14]** 🔧 Using tool: `unknown`
**[2026-03-25 13:59:24]** 🧠 Thinking: The test failures are pre-existing (`toBeInTheDocument` from testing-library/jest-dom not loading properly for MessageInput and MessageList tests). Le
**[2026-03-25 13:59:24]** 🔧 Using tool: `unknown`
**[2026-03-25 13:59:33]** 🔧 Using tool: `unknown`
**[2026-03-25 13:59:40]** 🔧 Using tool: `unknown`
**[2026-03-25 13:59:54]** 🧠 Thinking: The `toBeInTheDocument` matcher is not available — this is a pre-existing issue with the test setup (missing `@testing-library/jest-dom` integration).
**[2026-03-25 13:59:54]** 🔧 Using tool: `unknown`
**[2026-03-25 14:00:01]** 🔧 Using tool: `unknown`
**[2026-03-25 14:00:13]** 🧠 Thinking: So the setup file imports `@testing-library/jest-dom/vitest` but the tests are still failing with `Invalid Chai property: toBeInTheDocument`. This is 
**[2026-03-25 14:00:13]** 🔧 Using tool: `unknown`
**[2026-03-25 14:00:20]** 🔧 Using tool: `unknown`
**[2026-03-25 14:00:38]** 🧠 Thinking: The `toBeInTheDocument` matcher is failing globally — this is a pre-existing issue. I should adapt my new tests to not rely on `toBeInTheDocument` and
**[2026-03-25 14:00:38]** 🔧 Using tool: `unknown`
**[2026-03-25 14:00:57]** 🔧 Using tool: `unknown`
**[2026-03-25 14:01:02]** 🔧 Using tool: `unknown`
**[2026-03-25 14:01:26]** 🧠 Thinking: The dropdown menu items aren't being found. This is likely because Radix dropdown menu uses portals. The dropdown items render in a portal outside the
**[2026-03-25 14:01:26]** 🔧 Using tool: `unknown`
**[2026-03-25 14:01:31]** 🔧 Using tool: `unknown`
**[2026-03-25 14:01:52]** 🔧 Using tool: `unknown`
**[2026-03-25 14:01:55]** 🔧 Using tool: `unknown`
**[2026-03-25 14:02:18]** 🧠 Thinking: Still 4 failures, 2 passes. The 2 passing are the trigger render/not-render tests. The dropdown menu tests are failing because the menu items aren't a
**[2026-03-25 14:02:18]** 🔧 Using tool: `unknown`
**[2026-03-25 14:02:26]** 🧠 Thinking: OK so the matchers are being extended properly. The `toBeInTheDocument` failures earlier might actually be a different issue — maybe the matchers impo
**[2026-03-25 14:02:26]** 🔧 Using tool: `unknown`
**[2026-03-25 14:02:33]** 🧠 Thinking: The notification dropdown test passes! So the approach works. Let me look at the notification test more carefully to see what might differ:
**[2026-03-25 14:02:33]** 🔧 Using tool: `unknown`
**[2026-03-25 14:02:44]** 🧠 Thinking: I see — the notification test finds elements by `getByText` rather than `getByTestId`. The actual dropdown content DOES render (because `pointerDown` 
**[2026-03-25 14:02:44]** 🔧 Using tool: `unknown`
**[2026-03-25 14:02:50]** 🔧 Using tool: `unknown`
**[2026-03-25 14:02:57]** 🔧 Using tool: `unknown`
**[2026-03-25 14:03:17]** 🧠 Thinking: The HTML output shows the sidebar rendered correctly, but no dropdown menu items are appearing. The `pointerDown` is not opening the dropdown. This co
**[2026-03-25 14:03:17]** 🔧 Using tool: `unknown`
**[2026-03-25 14:03:21]** 🔧 Using tool: `unknown`
**[2026-03-25 14:03:26]** 🔧 Using tool: `unknown`
**[2026-03-25 14:03:34]** 🔧 Using tool: `unknown`
**[2026-03-25 14:03:38]** 🔧 Using tool: `unknown`
**[2026-03-25 14:03:45]** 🔧 Using tool: `unknown`
**[2026-03-25 14:03:54]** 🔧 Using tool: `unknown`
**[2026-03-25 14:03:54]** 🔧 Using tool: `unknown`
**[2026-03-25 14:04:04]** 🔧 Using tool: `unknown`
**[2026-03-25 14:04:12]** 🔧 Using tool: `unknown`
**[2026-03-25 14:04:20]** 🔧 Using tool: `unknown`
**[2026-03-25 14:04:53]** 🔧 Using tool: `unknown`
**[2026-03-25 14:05:27]** 🔧 Using tool: `unknown`
**[2026-03-25 14:06:00]** 🔧 Using tool: `unknown`
**[2026-03-25 14:06:33]** 🔧 Using tool: `unknown`
**[2026-03-25 14:07:39]** 🔧 Using tool: `unknown`
**[2026-03-25 14:07:44]** 🔧 Using tool: `unknown`
**[2026-03-25 14:07:49]** 🔧 Using tool: `unknown`
**[2026-03-25 14:07:53]** 🔧 Using tool: `unknown`
**[2026-03-25 14:08:03]** 🔧 Using tool: `unknown`

**[2026-03-25 14:08:17]** ✅ Fry completed this task.

**Result:**
All lint/prettier checks passed and the commit succeeded! Here's a summary:

## ✅ Done! Clear Chat button added

**Files changed (6):**

| File | What |
|------|------|
| `apps/web/src/components/ui/alert-dialog.tsx` | **New** — shadcn AlertDialog component (`@radix-ui/react-alert-dialog`) |
| `apps/web/src/components/chat/chat-sidebar.tsx` | **Updated** — Added dropdown menu (🗑️ Trash2 icon) in sidebar header with "Clear this chat" and "Clear all chats" options, gated by AlertDialog confirmation |
| `apps/web/app/chat/chat-client.tsx` | **Updated** — Wired `onClearChat` and `onClearAllChats` callbacks to sidebar via `useClearChat` hook |
| `apps/web/src/hooks/use-chat.ts` | **Updated** — Consolidated duplicate `useClearChat`, now supports both per-channel (`mutate("agent-id")`) and all-channels (`mutate(undefined)`) clearing |
| `apps/web/src/components/chat/__tests__/chat.test.tsx` | **Updated** — Added 7 new tests + Radix jsdom polyfills (also fixed pre-existing test failures) |
| `apps/web/package.json` | **Updated** — Added `@radix-ui/react-alert-dialog` dependency |

**All 25 tests pass** ✅
