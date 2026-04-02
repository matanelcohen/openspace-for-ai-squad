---
id: task-Vp80pzr-
title: Wire up AbortController in components with async operations
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-tJllVLTG'
created: '2026-04-02T10:31:21.844Z'
updated: '2026-04-02T11:05:08.605Z'
sortIndex: 26
parent: task-tJllVLTG
dependsOn:
  - task-KP_kbLf5
---
In settings/page.tsx (handleCleanWorktrees) and traces/page.tsx (handleClearAll), create an AbortController, pass its signal through apiClient calls, and abort on unmount (useEffect cleanup) or when a new request supersedes the old one. Audit for any other components that fire apiClient calls on user action and may suffer the same unmounted-setState issue — wire those up too.

---
**[2026-04-02 11:02:46]** 🚀 Fry started working on this task.
**[2026-04-02 11:02:46]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:05:08]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
