---
id: task-MzgxOuZB
title: Fix VoiceSpeaker setTimeout memory leak and useEffect deps
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-fNCJA11L'
created: '2026-04-02T02:15:33.473Z'
updated: '2026-04-02T02:56:15.500Z'
sortIndex: 625
parent: task-fNCJA11L
---
In apps/web voice-speaker.tsx: (1) Create a ref (e.g. useRef<NodeJS.Timeout[]>([])) to store setTimeout IDs from lines ~75 and ~91. (2) Add a useEffect cleanup that clears all stored timeouts on unmount via clearTimeout. (3) Fix the useEffect at line ~108 by adding the correct dependency array. Ensure no regressions in voice playback behavior.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:56:15]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
