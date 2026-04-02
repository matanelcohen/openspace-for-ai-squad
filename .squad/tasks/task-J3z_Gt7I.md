---
id: task-J3z_Gt7I
title: Add keyboard accessibility and ARIA support to escalation components
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-EhKmEKPF'
created: '2026-04-02T03:30:52.586Z'
updated: '2026-04-02T03:31:16.152Z'
sortIndex: 670
parent: task-EhKmEKPF
---
Add keyboard accessibility and ARIA attributes to the escalation review queue and related components:

1. **`review-queue-table.tsx`**: Add `tabIndex={0}` and `onKeyDown` handler (Enter/Space to activate) to each clickable row. Add `role="row"` and `role="gridcell"` to table elements.
2. **Badge components** (`priority-indicator.tsx`, `escalation-status-badge.tsx`, `confidence-badge.tsx`): Add descriptive `aria-label` attributes to icons so screen readers can announce their meaning (e.g. `aria-label="Priority: high"`).
3. **Bulk selection area in review-queue-table**: Add an `aria-live="polite"` region that announces how many items are selected.
4. **audit-trail-timeline.tsx**: Add appropriate ARIA roles/labels to timeline entries.

Ensure all interactive elements have visible focus indicators.

---
**[2026-04-02 03:30:56]** 🚀 Fry started working on this task.
**[2026-04-02 03:30:56]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 03:31:16]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
