---
id: task-OKufm4XK
title: Fix case-sensitivity bugs in escalation components
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-cnoC89oM'
created: '2026-04-02T03:01:02.116Z'
updated: '2026-04-02T03:15:36.362Z'
sortIndex: 658
parent: task-cnoC89oM
---
Fix 2 case-sensitivity bugs where agent/actor name lookups fail due to inconsistent casing:

1. **`apps/web/src/components/escalations/escalation-detail-panel.tsx` (line 39)**: Change `a.name.toLowerCase() === id` to `a.name.toLowerCase() === id.toLowerCase()` — currently the `id` parameter is not normalized, so lookups fail when IDs have mixed case.

2. **`apps/web/src/components/escalations/audit-trail-timeline.tsx` (line 14)**: Same pattern — change `a.name.toLowerCase() === actorId` to `a.name.toLowerCase() === actorId.toLowerCase()`.

Both bugs cause agent resolution to silently fail when identifiers from the API come in mixed case.

---
**[2026-04-02 03:07:50]** 🚀 Fry started working on this task.
**[2026-04-02 03:07:50]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 03:15:36]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
