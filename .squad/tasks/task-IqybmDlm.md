---
id: task-IqybmDlm
title: SSR-safe localStorage and schema validation in TaskFiltersToolbar
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-EqT10rca'
created: '2026-04-02T11:09:00.069Z'
updated: '2026-04-02T11:11:56.157Z'
sortIndex: 87
parent: task-EqT10rca
---
In apps/web, find task-filters-toolbar.tsx and fix the loadPresets function:
1. Add a `typeof window !== 'undefined'` guard around all localStorage calls to prevent SSR hydration mismatches.
2. Add schema validation on the parsed JSON array — validate that each preset object has the expected shape (e.g. required fields, correct types). If validation fails, return a sensible default (empty array) and log a warning via console.warn.
3. Use a useEffect + useState pattern to hydrate preset state only after mount (client-side), so the server render and initial client render match.
4. Make sure the component renders a safe default (empty presets) during SSR/initial render, then hydrates from localStorage after mount.

Do NOT change any unrelated code. Ensure TypeScript compiles cleanly after your changes.

---
**[2026-04-02 11:11:41]** 🚀 Fry started working on this task.
**[2026-04-02 11:11:41]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:11:56]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
