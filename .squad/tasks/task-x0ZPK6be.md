---
id: task-x0ZPK6be
title: Implement useCreateChannel and useUpdateChannel mutation hooks
status: done
priority: P1
assignee: fry
labels:
  - frontend
  - hooks
  - tanstack-query
  - optimistic-updates
  - 'parent:task-eLmi8eT_'
created: '2026-03-25T15:03:32.011Z'
updated: '2026-03-25T16:44:23.819Z'
sortIndex: 84
---
Create useCreateChannel and useUpdateChannel hooks using TanStack Query's useMutation. Connect to POST /api/channels and PATCH /api/channels/:id endpoints. Implement optimistic updates: on mutate, update the query cache immediately (append new channel or merge updated fields), and rollback on error using onError context. Invalidate ['channels'] queries on settlement.

---
**[2026-03-25 16:37:51]** 🚀 Fry started working on this task.

---
**[2026-03-25 16:44:23]** 🚀 Fry started working on this task.

**Progress:**
**[2026-03-25 16:43:24]** 🧠 Thinking: Let me start by exploring the codebase to understand the project structure, existing patterns for hooks, and how the API layer is set up.
**[2026-03-25 16:43:24]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:24]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:27]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:27]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:27]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:29]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:29]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:29]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:29]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:29]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:29]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:31]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:31]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:31]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:34]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:34]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:34]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:36]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:36]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:36]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:36]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:38]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:38]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:38]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:38]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:40]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:40]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:40]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:40]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:40]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:40]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:44]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:44]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:44]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:44]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:44]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:44]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:44]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:44]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:44]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:44]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:44]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:51]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:51]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:51]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:51]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:51]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:52]** 🧠 Thinking: I can see that `use-channels.ts` already has `useCreateChannel` and `useUpdateChannel` mutation hooks fully implemented! They are already there with o
**[2026-03-25 16:43:52]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:52]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:55]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:56]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:56]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:56]** 🔧 Using tool: `unknown`
**[2026-03-25 16:43:56]** 🔧 Using tool: `unknown`
**[2026-03-25 16:44:01]** 🔧 Using tool: `unknown`
**[2026-03-25 16:44:01]** 🔧 Using tool: `unknown`
**[2026-03-25 16:44:01]** 🔧 Using tool: `unknown`
**[2026-03-25 16:44:02]** 🧠 Thinking: The hooks and tests are already fully implemented! Let me verify they pass by running the tests.
**[2026-03-25 16:44:02]** 🔧 Using tool: `unknown`
**[2026-03-25 16:44:02]** 🔧 Using tool: `unknown`
**[2026-03-25 16:44:05]** 🔧 Using tool: `unknown`
**[2026-03-25 16:44:05]** 🔧 Using tool: `unknown`
**[2026-03-25 16:44:05]** 🔧 Using tool: `unknown`
**[2026-03-25 16:44:08]** 🔧 Using tool: `unknown`
**[2026-03-25 16:44:08]** 🔧 Using tool: `unknown`
**[2026-03-25 16:44:13]** 🔧 Using tool: `unknown`

**[2026-03-25 16:44:23]** ✅ Fry completed this task.

**Result:**
All **16 tests pass** ✅

The task is already complete — `useCreateChannel` and `useUpdateChannel` are fully implemented in `apps/web/src/hooks/use-channels.ts` with:

- **`useCreateChannel`** — `POST /api/channels`, optimistically appends a temp channel to cache, rolls back on error, invalidates `['channels']` on settlement
- **`useUpdateChannel`** — `PATCH /api/channels/:id`, optimistically merges fields into both list and detail caches, rolls back both on error, invalidates both on settlement

All 16 hook tests pass including optimistic update and rollback scenarios. No further changes needed! 🎉
