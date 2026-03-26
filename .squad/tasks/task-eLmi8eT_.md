---
id: task-eLmi8eT_
title: Channel React hooks
status: done
priority: P1
assignee: fry
labels:
  - channels
  - frontend
  - hooks
created: '2026-03-25T15:03:00.032Z'
updated: '2026-03-25T20:13:46.196Z'
sortIndex: 68
---
Create useChannels, useChannel, useCreateChannel, useUpdateChannel hooks using TanStack Query. Connect to the channel REST API endpoints. Include optimistic updates and WebSocket-driven cache invalidation.

---
**[2026-03-25 20:13:46]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-25 20:12:28]** 🧠 Thinking: Let me analyze this task. I need to create React hooks for channel management using TanStack Query, connected to REST API endpoints, with optimistic u
**[2026-03-25 20:12:28]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:28]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:31]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:31]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:31]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:33]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:33]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:33]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:33]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:35]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:35]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:35]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:37]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:37]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:37]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:37]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:39]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:39]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:39]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:43]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:43]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:43]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:43]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:43]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:46]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:46]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:46]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:46]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:48]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:48]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:48]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:48]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:50]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:50]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:50]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:50]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:53]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:53]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:53]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:53]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:55]** 🧠 Thinking: I can see there are already existing hooks and API routes for channels. Let me look at the existing files to understand the patterns and what needs to
**[2026-03-25 20:12:55]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:55]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:55]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:55]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:55]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:55]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:57]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:57]** 🔧 Using tool: `unknown`
**[2026-03-25 20:12:57]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:01]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:01]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:01]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:05]** 🧠 Thinking: Looking at the codebase, I can see that all the requested hooks already exist:

1. `useChannels` - in `apps/web/src/hooks/use-channels.ts` (line 27-37
**[2026-03-25 20:13:05]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:06]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:06]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:09]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:09]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:09]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:13]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:13]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:14]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:17]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:23]** 🧠 Thinking: Alright, the code is all already implemented! Let me check the full picture:

1. `useChannels` ✅ - exists in `use-channels.ts` line 27-37
2. `useChann
**[2026-03-25 20:13:23]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:23]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:28]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:28]** 🔧 Using tool: `unknown`
**[2026-03-25 20:13:32]** 🔧 Using tool: `unknown`

**[2026-03-25 20:13:46]** ✅ Fry completed this task.

**Result:**
All **34 tests pass**. ✅

The task is already fully implemented:

| Hook | File | Features |
|------|------|----------|
| `useChannels` | `use-channels.ts:27` | Fetches all channels, triggers WS cache sync |
| `useChannel(id)` | `use-channels.ts:40` | Fetches single channel by ID |
| `useCreateChannel` | `use-channels.ts:53` | POST + optimistic append + rollback on error |
| `useUpdateChannel` | `use-channels.ts:88` | PATCH + optimistic merge (list + detail) + rollback |
| `useDeleteChannel` | `use-channels.ts:137` | DELETE + cache eviction |
| WS cache invalidation | `use-channel-cache-sync.ts` | Granular setQueryData + debounced backstop invalidation for `channel:created/updated/deleted` events |

Everything connects to the REST API via `api-client.ts`, uses TanStack Query with optimistic updates, and has WebSocket-driven cache invalidation with debounced backstop refetches. All 34 tests pass.
