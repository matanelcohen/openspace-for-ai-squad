---
id: task-RdXRiCDm
title: Channel React hooks
status: done
priority: P1
assignee: fry
labels:
  - channels
  - frontend
  - hooks
created: '2026-03-25T20:08:13.965Z'
updated: '2026-03-31T21:51:04.676Z'
sortIndex: 15
---
Build useChannels, useCreateChannel, useUpdateChannel, useDeleteChannel React hooks using React Query. Connect to the channel REST API endpoints.

---
**[2026-03-25 22:31:15]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-25 22:30:08]** 🧠 Thinking: Let me start by exploring the codebase to understand the project structure, existing patterns for React hooks, React Query usage, and the channel REST
**[2026-03-25 22:30:08]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:08]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:12]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:12]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:12]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:13]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:13]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:13]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:13]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:13]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:13]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:15]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:15]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:15]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:19]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:19]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:19]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:22]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:22]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:22]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:22]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:22]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:22]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:23]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:23]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:23]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:23]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:23]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:29]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:29]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:29]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:29]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:29]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:30]** 🧠 Thinking: I can see there's already a `use-channels.ts` file. Let me look at the existing hooks, the API client, the channel routes, and the shared types to und
**[2026-03-25 22:30:30]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:30]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:30]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:30]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:30]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:30]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:33]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:33]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:33]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:33]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:33]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:33]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:37]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:37]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:37]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:37]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:37]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:38]** 🧠 Thinking: Interesting! The hooks already exist in `use-channels.ts`. Let me check the existing tests and see if there are tests for these hooks already.
**[2026-03-25 22:30:38]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:38]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:38]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:40]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:40]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:40]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:42]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:44]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:44]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:44]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:44]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:45]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:48]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:48]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:48]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:51]** 🧠 Thinking: The hooks already exist and have comprehensive tests. Let me check what the current status is - are all the hooks fully implemented and tested? Let me
**[2026-03-25 22:30:51]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:51]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:56]** 🔧 Using tool: `unknown`
**[2026-03-25 22:30:56]** 🔧 Using tool: `unknown`
**[2026-03-25 22:31:01]** 🔧 Using tool: `unknown`

**[2026-03-25 22:31:15]** ✅ Fry completed this task.

**Result:**
All 34 tests pass! ✅

The channel React hooks are **already fully implemented and tested**. Here's what exists in `apps/web/src/hooks/use-channels.ts`:

| Hook | Description |
|------|-------------|
| `useChannels()` | Fetches all channels via `GET /api/channels` with stale/gc time + WS cache sync |
| `useChannel(id)` | Fetches single channel via `GET /api/channels/:id` |
| `useCreateChannel()` | Creates channel via `POST /api/channels` with optimistic updates |
| `useUpdateChannel()` | Updates channel via `PATCH /api/channels/:id` with optimistic list + detail cache updates |
| `useDeleteChannel()` | Deletes channel via `DELETE /api/channels/:id` with cache invalidation |
| `useChannelMessages(id)` | Fetches messages for a channel (wraps `useChatMessages`) |
| `useSendChannelMessage(id)` | Sends message to a channel (wraps `useSendMessage`) |

Plus a `channelKeys` query-key factory and real-time WebSocket cache sync via `useChannelCacheSync`. All 34 tests pass. This task is already complete! 🎉
