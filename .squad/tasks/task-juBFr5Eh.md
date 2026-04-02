---
id: task-juBFr5Eh
title: Add defensive fallbacks and validation UX to escalation components
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-qXw7ldX4'
created: '2026-04-02T02:18:59.730Z'
updated: '2026-04-02T02:56:43.793Z'
sortIndex: 635
parent: task-qXw7ldX4
---
Fix four escalation components:

1. **PriorityIndicator**: Add a fallback when the priority value doesn't match any known config entry. Render a neutral/default style instead of crashing on `undefined` config access.

2. **EscalationStatusBadge**: Same pattern — add a fallback for unknown status values so the badge renders a generic 'unknown' state instead of throwing.

3. **SLACountdown**: Validate the incoming date string before computing the countdown. If the date is invalid (NaN, empty, malformed), render a fallback message like 'Invalid deadline' instead of propagating NaN through the UI.

4. **EscalationChainEditor**: The component already computes validation errors but never renders them. Wire the existing validation error state into visible inline error messages near the relevant form fields so users can see what's wrong.

For all changes, keep the existing happy-path behavior identical. Only add handling for edge/error cases.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:56:43]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
