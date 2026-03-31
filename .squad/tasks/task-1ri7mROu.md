---
id: task-1ri7mROu
title: Add useClearChat hook with React Query cache invalidation
status: done
priority: P0
assignee: fry
labels:
  - frontend
  - hooks
  - chat
  - react-query
  - 'parent:task-meNX3cL6'
created: '2026-03-25T13:45:36.759Z'
updated: '2026-03-31T21:51:04.784Z'
sortIndex: 63
---
Create a useClearChat() mutation hook in apps/web/src/hooks/use-chat.ts following the existing useDeleteTeamMember pattern. Use api.delete('/api/chat/messages') with optional agent param. On success, invalidate the ['chat', recipient] query key so the UI refreshes. Include optimistic update to immediately clear the message list, with rollback on error. Optionally broadcast a WebSocket event so other clients update too.

---
**[2026-03-25 13:48:38]** 🚀 Fry started working on this task.

---
**[2026-03-25 13:50:16]** 🚀 Fry started working on this task.

---
**[2026-03-25 13:53:06]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-25 13:51:36]** 🧠 Thinking: Let me start by exploring the codebase to understand the existing patterns, particularly the `useDeleteTeamMember` pattern and the chat-related hooks.
**[2026-03-25 13:51:36]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:36]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:39]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:42]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:42]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:42]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:42]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:42]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:42]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:46]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:46]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:46]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:46]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:46]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:50]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:50]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:53]** 🔧 Using tool: `unknown`
**[2026-03-25 13:51:53]** 🔧 Using tool: `unknown`
**[2026-03-25 13:52:31]** 🧠 Thinking: I now have a complete picture of the codebase. Let me implement the `useClearChat` hook. The existing `use-chat.ts` already has:

1. A `chat:cleared` 
**[2026-03-25 13:52:31]** 🔧 Using tool: `unknown`
**[2026-03-25 13:52:31]** 🔧 Using tool: `unknown`
**[2026-03-25 13:52:37]** 🔧 Using tool: `unknown`
**[2026-03-25 13:52:40]** 🔧 Using tool: `unknown`
**[2026-03-25 13:52:40]** 🔧 Using tool: `unknown`
**[2026-03-25 13:52:45]** 🔧 Using tool: `unknown`
**[2026-03-25 13:52:56]** 🔧 Using tool: `unknown`

**[2026-03-25 13:53:06]** ✅ Fry completed this task.

**Result:**
Zero type errors in our file. ✅

Here's what I added to `apps/web/src/hooks/use-chat.ts` (lines 109–135):

**`useClearChat(recipient)`** — a mutation hook that:
- **Calls** `api.delete('/api/chat/messages')` with an optional `?agent=` query param
- **Optimistic update** — immediately sets `['chat', recipient]` cache to `[]` so the UI clears instantly
- **Rollback** — restores the previous messages on error
- **Cache invalidation** — calls `invalidateQueries` on success to ensure server consistency
- **WebSocket broadcast** — sends a `chat:cleared` event via `wsSend` so other open tabs/clients clear too (the existing `useChatMessages` listener already handles incoming `chat:cleared` events)

Usage:
```tsx
const clearChat = useClearChat('agent-123');
// Clear all messages for the recipient
clearChat.mutate();
// Or target a specific agent
clearChat.mutate('agent-456');
```
