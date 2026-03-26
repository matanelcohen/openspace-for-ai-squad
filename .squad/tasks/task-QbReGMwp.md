---
id: task-QbReGMwp
title: Update Thread Composer input to match ChatGPT-style alignment
status: done
priority: P0
assignee: fry
labels:
  - frontend
  - UI
  - chat
  - UX
  - 'parent:task-jynkIPT9'
created: '2026-03-26T10:22:46.199Z'
updated: '2026-03-26T10:42:28.088Z'
sortIndex: 177
---
Update the Composer component in /apps/web/src/components/assistant-ui/thread.tsx (the @assistant-ui/react ComposerPrimitive wrapper) to have the same ChatGPT-style open/close alignment as the MessageInput. Ensure both input boxes have consistent look and feel. The ComposerPrimitive.Root wrapper div styling needs to support compact/expanded states with transitions.

---
**[2026-03-26 10:42:28]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-26 10:38:25]** 🧠 Thinking: Let me start by understanding the current state of the codebase - I need to look at the thread.tsx file and understand the current Composer component,
**[2026-03-26 10:38:25]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:25]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:25]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:29]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:29]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:29]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:30]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:30]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:30]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:30]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:30]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:30]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:34]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:34]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:34]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:38]** 🔧 Using tool: `unknown`
**[2026-03-26 10:38:38]** 🔧 Using tool: `unknown`
**[2026-03-26 10:39:41]** 🧠 Thinking: Now I understand both components. Let me analyze the key differences:

**MessageInput (ChatGPT-style):**
1. Has an `isOpen` state based on focus/conte
**[2026-03-26 10:39:41]** 🔧 Using tool: `unknown`
**[2026-03-26 10:39:41]** 🔧 Using tool: `unknown`
**[2026-03-26 10:39:41]** 🔧 Using tool: `unknown`
**[2026-03-26 10:39:48]** 🧠 Thinking: Now I have a clear picture. Let me find the assistant-ui package to check what hooks are available for tracking composer state.
**[2026-03-26 10:39:48]** 🔧 Using tool: `unknown`
**[2026-03-26 10:39:48]** 🔧 Using tool: `unknown`
**[2026-03-26 10:39:48]** 🔧 Using tool: `unknown`
**[2026-03-26 10:39:54]** 🔧 Using tool: `unknown`
**[2026-03-26 10:39:59]** 🔧 Using tool: `unknown`
**[2026-03-26 10:40:06]** 🔧 Using tool: `unknown`
**[2026-03-26 10:40:11]** 🔧 Using tool: `unknown`
**[2026-03-26 10:40:15]** 🔧 Using tool: `unknown`
**[2026-03-26 10:40:23]** 🔧 Using tool: `unknown`
**[2026-03-26 10:40:28]** 🔧 Using tool: `unknown`
**[2026-03-26 10:40:40]** 🧠 Thinking: Now I can see that `BaseComposerState` has:
- `isEmpty: boolean`
- `text: string`

So I can use `useAuiState((s) => s.composer.isEmpty)` or similar to
**[2026-03-26 10:40:40]** 🔧 Using tool: `unknown`
**[2026-03-26 10:40:45]** 🔧 Using tool: `unknown`
**[2026-03-26 10:41:23]** 🧠 Thinking: Now I have the full picture. The correct way to access composer state in `@assistant-ui/react` v0.12 is:

- `useAuiState((s) => s.composer.text)` - ge
**[2026-03-26 10:41:23]** 🔧 Using tool: `unknown`
**[2026-03-26 10:41:34]** 🔧 Using tool: `unknown`
**[2026-03-26 10:41:39]** 🔧 Using tool: `unknown`
**[2026-03-26 10:41:44]** 🔧 Using tool: `unknown`
**[2026-03-26 10:41:44]** 🔧 Using tool: `unknown`
**[2026-03-26 10:41:48]** 🔧 Using tool: `unknown`
**[2026-03-26 10:41:48]** 🔧 Using tool: `unknown`
**[2026-03-26 10:41:58]** 🧠 Thinking: The errors are all in other files, not in thread.tsx. Let me grep to see if there are any errors from our file specifically.
**[2026-03-26 10:41:58]** 🔧 Using tool: `unknown`
**[2026-03-26 10:42:05]** 🔧 Using tool: `unknown`
**[2026-03-26 10:42:18]** 🧠 Thinking: The diff looks good. I notice the diff also includes some other changes that were already in the working tree before I started (the agent names/emoji/
**[2026-03-26 10:42:18]** 🔧 Using tool: `unknown`

**[2026-03-26 10:42:28]** ✅ Fry completed this task.

**Result:**
No existing tests for the Composer. Here's a summary of what I did:

---

🎨 **Updated Thread Composer with ChatGPT-style open/close alignment!**

**Changes in `apps/web/src/components/assistant-ui/thread.tsx`:**

1. **Added `isOpen` state** — tracks `focused` (via `useState`) and `hasContent` (via `useAuiState((s) => !s.composer.isEmpty)`) to compute `isOpen = focused || hasContent`

2. **Composer root** — narrows to `max-w-2xl mx-auto` when closed, expands to full width when open (matches MessageInput centering behavior)

3. **Shell div** — transitions between compact (`gap-0 p-2 scale-[0.98]`) and expanded (`gap-2 p-(--composer-padding) scale-100`) states. Focus ring uses explicit `border-ring/75 ring-2 ring-ring/20 shadow-sm` on focus vs `border-input hover:border-ring/40` when idle

4. **Input textarea** — transitions height: `max-h-10 min-h-[36px]` closed → `max-h-40 min-h-[40px]` open

5. **Action bar** — slides in/out with `max-h-12 opacity-100` ↔ `max-h-0 opacity-0`

6. **All transitions** use `duration-300 ease-in-out` matching MessageInput exactly

✅ TypeScript checks pass — zero errors in thread.tsx.
