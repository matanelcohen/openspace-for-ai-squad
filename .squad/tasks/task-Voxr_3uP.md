---
id: task-Voxr_3uP
title: Add default staleTime to all react-query hooks
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-qKQAfY5R'
created: '2026-04-02T11:07:10.523Z'
updated: '2026-04-02T11:12:05.135Z'
sortIndex: 78
parent: task-qKQAfY5R
---
Find all useQuery hooks in apps/web that currently have no staleTime set (defaults to 0). Known locations include use-skills.ts:73, use-sandboxes.ts:25, use-agent-status.ts:31, but there are ~15 total. Add staleTime: 60_000 to each hook's options. This prevents unnecessary refetches on every component mount when active refetchInterval polling is already keeping data fresh. Search for all useQuery calls in apps/web and update each one.

---
**[2026-04-02 11:11:41]** 🚀 Fry started working on this task.
**[2026-04-02 11:11:41]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:12:05]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
