---
id: task-NHXWKjaS
title: Fix escalation component crash guards and error handling
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-33PkX-Ya'
created: '2026-04-02T00:36:19.775Z'
updated: '2026-04-02T00:37:28.174Z'
sortIndex: 545
parent: task-33PkX-Ya
---
Four fixes in apps/web/src/components/escalations/:

1. **priority-indicator.tsx** (line 42): `priorityConfig[priority]` has no null guard — crashes on unknown priority values. Add a fallback config object (e.g. gray circle icon with 'Unknown' label) when the lookup returns undefined.

2. **escalation-status-badge.tsx** (line 55): Same issue — `statusConfig[status]` crashes on unknown status. Add identical null-guard fallback pattern.

3. **bulk-action-toolbar.tsx** (lines 37-47): `handleConfirm` awaits `bulkApprove.mutateAsync`/`bulkReject.mutateAsync` but has no try/catch. On mutation failure, it still runs `setAction(null)`, `setComment('')`, and `onClearSelection()`. Wrap the mutation calls in try/catch — on error, show an error toast (use the project's existing toast system) and do NOT clear selection/dialog. Only clear on success.

4. **escalation-detail-panel.tsx** (lines 51-61): `handleApprove`, `handleReject`, `handleRequestChanges` all call `setComment('')` immediately after `.mutate()` — before the mutation succeeds. Move `setComment('')` into the `onSuccess` callback of each `.mutate()` call so user input is preserved on error.

---
**[2026-04-02 00:36:58]** 🚀 Fry started working on this task.
**[2026-04-02 00:36:58]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:01]** 🚀 Fry started working on this task.
**[2026-04-02 00:37:01]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:04]** 🚀 Fry started working on this task.
**[2026-04-02 00:37:04]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:20]** 🚀 Fry started working on this task.
**[2026-04-02 00:37:20]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:20]** 🚀 Fry started working on this task.
**[2026-04-02 00:37:20]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:21]** 🚀 Fry started working on this task.
**[2026-04-02 00:37:21]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:24]** 🚀 Fry started working on this task.
**[2026-04-02 00:37:24]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 00:37:28]** 🛑 Blocked after 5 execution attempts.

**Last error:** Max attempts reached
