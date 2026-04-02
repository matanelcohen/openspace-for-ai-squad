---
id: task-OsMOCOd6
title: Add onError toast notifications to all silent mutation call sites
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-e0QwUbtd'
created: '2026-04-02T11:06:08.457Z'
updated: '2026-04-02T11:11:51.564Z'
sortIndex: 67
parent: task-e0QwUbtd
---
Fix at least 5 mutation call sites that silently swallow errors:
1. `traces/page.tsx` handleClearAll (line ~20) — add a catch block that shows a toast notification.
2. `escalation-detail-panel.tsx` handleClaim/handleApprove (lines ~50-62) — add onError callbacks that display toast notifications.
3. `chat-client.tsx` handleSaveChannel (line ~111) — add error handling so the dialog shows an inline error message (or toast) instead of staying open silently.
4. `skills/gallery/[id]/page.tsx` handleInstall (line ~44) — replace the empty catch block with a toast notification.

Use the existing toast/notification system in the app. If none exists, add a lightweight toast utility (e.g., sonner or react-hot-toast). Each error toast should include a user-friendly message describing what failed (e.g., 'Failed to clear traces', 'Failed to claim escalation'). Keep the error messages consistent in tone and format across all sites.

---
**[2026-04-02 11:11:41]** 🚀 Fry started working on this task.
**[2026-04-02 11:11:41]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:11:51]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
