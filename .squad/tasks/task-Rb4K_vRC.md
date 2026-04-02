---
id: task-Rb4K_vRC
title: 'Implement keyboard accessibility, ARIA support, and fix actor name case bug'
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-pPWG9AZp'
created: '2026-04-02T00:28:40.767Z'
updated: '2026-04-02T01:41:55.016Z'
sortIndex: 535
parent: task-pPWG9AZp
---
In apps/web/src/components/escalations/:

1. **review-queue-table.tsx**: Add `role="row"` and `tabIndex={0}` to clickable rows. Add `onKeyDown` handler that triggers row click on Enter/Space. Add an `aria-live="polite"` region that announces the bulk selection count (e.g. '3 items selected').

2. **priority-indicator.tsx**: Add descriptive `aria-label` to the priority icon (e.g. `aria-label="Priority: high"`).

3. **escalation-status-badge.tsx**: Add `aria-label` to the status icon (e.g. `aria-label="Status: pending review"`).

4. **confidence-badge.tsx**: Add `aria-label` to the confidence icon (e.g. `aria-label="Confidence: 85%"`).

5. **audit-trail-timeline.tsx**: Fix the case-sensitivity bug — the code compares `a.name.toLowerCase()` against a non-lowercased `actorId`. Apply `.toLowerCase()` to both sides of the comparison.

All changes are in apps/web/src/components/escalations/. Ensure existing tests still pass after changes.

---
**[2026-04-02 00:33:30]** 🚀 Fry started working on this task.
**[2026-04-02 00:33:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:33:42]** 🚀 Fry started working on this task.
**[2026-04-02 00:33:42]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:34:09]** 🚀 Fry started working on this task.
**[2026-04-02 00:34:09]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:34:15]** 🚀 Fry started working on this task.

---
**[2026-04-02 00:34:16]** 🚀 Fry started working on this task.
**[2026-04-02 00:34:16]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:35:30]** 🚀 Fry started working on this task.
**[2026-04-02 00:35:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:35:51]** 🚀 Fry started working on this task.
**[2026-04-02 00:35:51]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:36:08]** 🚀 Fry started working on this task.
**[2026-04-02 00:36:08]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:33]** 🚀 Fry started working on this task.
**[2026-04-02 00:37:33]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:41]** 🚀 Fry started working on this task.
**[2026-04-02 00:37:41]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:38:23]** 🚀 Fry started working on this task.
**[2026-04-02 00:38:23]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 01:12:27]** 🚀 Fry started working on this task.
**[2026-04-02 01:12:27]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 01:41:54]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
