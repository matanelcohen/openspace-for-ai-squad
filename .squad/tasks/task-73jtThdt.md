---
id: task-73jtThdt
title: Add unsaved-changes guard to workflow composer
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-Znbz0uwv'
created: '2026-04-02T02:20:43.621Z'
updated: '2026-04-02T02:56:58.475Z'
sortIndex: 643
parent: task-Znbz0uwv
---
In apps/**/workflows/compose/page.tsx, add navigation protection so users don't lose workflow composition work. Implement: (1) an isDirty state (useState or useRef) that flips to true whenever the user modifies any workflow field (nodes, edges, name, etc.), (2) a beforeunload event listener (in a useEffect) that calls e.preventDefault() when isDirty is true to catch browser navigation/refresh, (3) intercept in-app navigation (the 'Back to workflows' button and any Next.js router navigation) with a confirmation prompt ('You have unsaved changes. Are you sure you want to leave?'), and (4) reset isDirty to false after a successful save. Use Next.js router events or a custom hook for SPA navigation interception.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:56:58]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
