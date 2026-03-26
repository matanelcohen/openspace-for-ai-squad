---
id: task-Ae_7IoDq
title: Implement WebSocket-driven cache invalidation for channels
status: done
priority: P1
assignee: bender
labels:
  - backend
  - websocket
  - cache-invalidation
  - integration
  - 'parent:task-eLmi8eT_'
created: '2026-03-25T15:03:32.028Z'
updated: '2026-03-25T19:00:58.885Z'
sortIndex: 85
---
Wire up WebSocket event listeners (e.g. 'channel.created', 'channel.updated', 'channel.deleted') to invalidate or update TanStack Query cache entries. Use queryClient.invalidateQueries(['channels']) or queryClient.setQueryData for granular updates. Ensure invalidation is debounced/batched to avoid redundant refetches. Coordinate with existing WebSocket infrastructure.

---
**[2026-03-25 18:38:46]** 🚀 Bender started working on this task.

---
**[2026-03-25 18:40:49]** 🚀 Bender started working on this task.

---
**[2026-03-25 18:47:09]** 🚀 Bender started working on this task.

---
**[2026-03-25 18:51:28]** 🛑 Permanently blocked after 3 failed attempts.

---
**[2026-03-25 19:00:58]** 🚀 Bender started working on this task.

**Progress:**
**[2026-03-25 18:51:41]** 🧠 Thinking: Let me look at the codebase to understand the existing WebSocket infrastructure and TanStack Query setup before implementing the cache invalidation.
**[2026-03-25 18:51:41]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:41]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:44]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:44]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:44]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:48]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:48]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:48]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:50]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:50]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:50]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:50]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:50]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:50]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:50]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:50]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:51]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:51]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:51]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:54]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:54]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:54]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:54]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:54]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:56]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:56]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:56]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:56]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:58]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:58]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:58]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:58]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:58]** 🔧 Using tool: `unknown`
**[2026-03-25 18:51:58]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:02]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:02]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:02]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:05]** 🧠 Thinking: I see there's already a `use-channel-cache-sync.ts` file. Let me read the key files to understand the existing infrastructure.
**[2026-03-25 18:52:05]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:05]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:05]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:05]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:05]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:05]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:05]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:06]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:06]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:06]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:06]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:09]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:09]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:09]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:11]** 🧠 Thinking: Let me look at the chat types to understand the ChatChannel interface and also check the existing test file.
**[2026-03-25 18:52:11]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:11]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:11]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:13]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:13]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:13]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:17]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:17]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:17]** 🧠 Thinking: Let me check the remaining parts of the test file and the API websocket code to understand what's already there:
**[2026-03-25 18:52:17]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:17]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:17]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:21]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:21]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:24]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:24]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:28]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:28]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:28]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:29]** 🧠 Thinking: Now I have a very clear picture. The implementation is actually already complete! Let me verify:

1. `use-channel-cache-sync.ts` - Already implements 
**[2026-03-25 18:52:29]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:29]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:31]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:38]** 🧠 Thinking: The test is failing due to module resolution - `@/hooks/use-channels` can't be resolved. Let me check the vitest config for the web app and the tsconf
**[2026-03-25 18:52:38]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:38]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:38]** 🔧 Using tool: `unknown`
**[2026-03-25 18:52:46]** 🧠 Thinking: The issue is that when running from the root directory, the root `vitest.config.ts` is being used instead of the web app's config. The root config doe
**[2026-03-25 18:52:46]** 🔧 Using tool: `unknown`
**[2026-03-25 18:53:22]** 🔧 Using tool: `unknown`
**[2026-03-25 18:53:47]** 🔧 Using tool: `unknown`
**[2026-03-25 18:54:10]** 🔧 Using tool: `unknown`
**[2026-03-25 18:54:52]** 🔧 Using tool: `unknown`
**[2026-03-25 18:54:59]** 🧠 Thinking: The test is hanging. Let me check if there's a setup file that might be causing issues, and also check if the test file has some issue with the mock s
**[2026-03-25 18:54:59]** 🔧 Using tool: `unknown`
**[2026-03-25 18:54:59]** 🔧 Using tool: `unknown`
**[2026-03-25 18:54:59]** 🔧 Using tool: `unknown`
**[2026-03-25 18:55:20]** 🔧 Using tool: `unknown`
**[2026-03-25 18:56:27]** 🔧 Using tool: `unknown`
**[2026-03-25 18:56:50]** 🧠 Thinking: The tests are timing out. The issue is that tests using `vi.useFakeTimers()` are timing out when they try to use `waitFor`. The problem is likely that
**[2026-03-25 18:56:50]** 🔧 Using tool: `unknown`
**[2026-03-25 18:56:50]** 🔧 Using tool: `unknown`
**[2026-03-25 18:56:57]** 🔧 Using tool: `unknown`
**[2026-03-25 18:57:04]** 🔧 Using tool: `unknown`
**[2026-03-25 18:57:25]** 🔧 Using tool: `unknown`
**[2026-03-25 18:58:32]** 🔧 Using tool: `unknown`
**[2026-03-25 18:58:46]** 🧠 Thinking: Let me check which test files failed to see if any are related to my changes. The voice-room tests are clearly pre-existing failures (unrelated to cha
**[2026-03-25 18:58:47]** 🔧 Using tool: `unknown`
**[2026-03-25 18:59:33]** 🔧 Using tool: `unknown`
**[2026-03-25 18:59:40]** 🧠 Thinking: There are a lot of changes. Let me focus on what's relevant to my task - the channel cache sync. Let me check what's already staged vs unstaged, and j
**[2026-03-25 18:59:40]** 🔧 Using tool: `unknown`
**[2026-03-25 18:59:45]** 🔧 Using tool: `unknown`
**[2026-03-25 18:59:51]** 🔧 Using tool: `unknown`
**[2026-03-25 18:59:57]** 🔧 Using tool: `unknown`
**[2026-03-25 19:00:06]** 🧠 Thinking: So the files are all new/untracked - they were created by previous attempts but never committed. They're already working (all 25 tests pass after my t
**[2026-03-25 19:00:06]** 🔧 Using tool: `unknown`
**[2026-03-25 19:00:18]** 🔧 Using tool: `unknown`
**[2026-03-25 19:00:48]** 🔧 Using tool: `unknown`

**[2026-03-25 19:00:58]** ✅ Bender completed this task.

**Result:**
Done. Here's what was implemented:

**`use-channel-cache-sync.ts`** — Central hook that listens to 3 WebSocket events:
- **`channel:created`** → appends to list cache, seeds detail cache, deduplicates
- **`channel:updated`** → merges into list + detail caches
- **`channel:deleted`** → removes from list, evicts detail cache

All events schedule a debounced `invalidateQueries` backstop (200ms) that coalesces rapid bursts into a single refetch.

**`use-channels.ts`** — Query/mutation hooks that integrate `useChannelCacheSync()` automatically when `useChannels()` is called.

**Fix applied:** `vi.useFakeTimers({ shouldAdvanceTime: true })` in tests — this was causing all 3 previous attempts to fail (fake timers blocked `waitFor` polling). All **25 tests pass**.
