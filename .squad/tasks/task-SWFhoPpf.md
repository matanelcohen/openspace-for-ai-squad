---
id: task-SWFhoPpf
title: Fix race condition and memory leak in ingestion polling
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-71j3OxiS'
created: '2026-04-02T02:12:06.255Z'
updated: '2026-04-02T02:55:33.498Z'
sortIndex: 612
parent: task-71j3OxiS
---
In `apps/web/**/ingestion-status.tsx`, fix the following issues:
1. `handleIngest` creates competing `setTimeout` calls (5s vs 120s) that both set `ingesting=false` — consolidate into a single coherent polling lifecycle with one timeout.
2. Repeated calls orphan intervals because timer IDs aren't stored in refs — store all `setInterval` and `setTimeout` IDs in `useRef` variables.
3. No cleanup on unmount causes leaked timers — add a `useEffect` cleanup return that clears all stored timer refs.
4. Ensure that starting a new ingest cancels any previously running timers before creating new ones.

Verify the fix doesn't break the normal ingest flow (start polling → status updates → completion).

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:55:33]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
