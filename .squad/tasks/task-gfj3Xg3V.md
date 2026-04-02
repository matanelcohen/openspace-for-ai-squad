---
id: task-gfj3Xg3V
title: Add staleTime/gcTime defaults and reduce polling intervals
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-Qormnc0C'
created: '2026-04-02T02:14:42.060Z'
updated: '2026-04-02T02:56:20.018Z'
sortIndex: 621
parent: task-Qormnc0C
---
Across all React Query hooks in apps/web/src/hooks/ (~10+ files including use-workflows.ts, use-skills.ts, use-cron.ts, use-autopilot.ts, and others), add staleTime: 30_000 and gcTime: 300_000 as defaults. Increase use-autopilot's refetchInterval from 5s to 15s. Where WebSocket event-driven invalidation is already available via the existing real-time infrastructure, replace refetchInterval polling with queryClient.invalidateQueries() calls triggered by WebSocket messages. Ensure no hook is left with aggressive polling and no staleTime. Verify the app still updates correctly after changes.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:56:20]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
