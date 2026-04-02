---
id: task-gYZACk27
title: Fix actor name case-sensitivity bug
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-EhKmEKPF'
created: '2026-04-02T03:30:52.519Z'
updated: '2026-04-02T03:31:11.673Z'
sortIndex: 669
parent: task-EhKmEKPF
---
Fix the case-sensitivity bug in two escalation components where `.toLowerCase()` is only applied to one side of the comparison:

1. `apps/web/src/components/escalations/audit-trail-timeline.tsx` (line 14): Change `a.name.toLowerCase() === actorId` to `a.name.toLowerCase() === actorId.toLowerCase()`
2. `apps/web/src/components/escalations/escalation-detail-panel.tsx` (line 39): Same fix — change `a.name.toLowerCase() === id` to `a.name.toLowerCase() === id.toLowerCase()`

This bug causes agent name resolution to silently fail when actorId has mixed case (e.g. 'Reviewer-1'), falling back to a formatted string instead of the actual agent name.

---
**[2026-04-02 03:30:55]** 🚀 Fry started working on this task.
**[2026-04-02 03:30:55]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 03:31:11]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
