---
id: task-VJH9--3T
title: Refactor skills page to single useSkills fetch
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-hSFh1VSv'
created: '2026-04-02T02:15:00.007Z'
updated: '2026-04-02T02:56:09.543Z'
sortIndex: 623
parent: task-hSFh1VSv
---
In apps/web/src/components/skills/page.tsx (lines ~56-60), remove the duplicate useSkills(filters) call. Keep only useSkills() (no filters) to fetch all skills once. Derive the filtered view using useMemo that applies the existing filter logic client-side. Compute installedIds from the same unfiltered dataset. This eliminates the redundant network request while preserving identical UI behavior.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 02:56:09]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
