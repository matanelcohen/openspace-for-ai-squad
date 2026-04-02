---
id: task-Hxx_q_tN
title: Fix VoiceSpeaker timer leaks and useEffect deps
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-gJkC2r4A'
created: '2026-04-02T10:28:31.726Z'
updated: '2026-04-02T11:04:10.586Z'
sortIndex: 14
parent: task-gJkC2r4A
---
In apps/web voice-speaker.tsx: (1) Create a useRef<Set<NodeJS.Timeout>> to track all setTimeout IDs created in processNext(). (2) On every setTimeout call, add the ID to the ref set; in the callback, remove it. (3) In the unmount cleanup of the main useEffect, iterate the ref set and clearTimeout each entry. (4) Fix the useEffect at ~line 108 that's missing its dependency array — audit closures and add the correct deps to prevent stale closure bugs and per-render re-runs. Verify no other untracked timers exist in the file.

---
**[2026-04-02 11:02:37]** 🚀 Fry started working on this task.
**[2026-04-02 11:02:37]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:04:10]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
