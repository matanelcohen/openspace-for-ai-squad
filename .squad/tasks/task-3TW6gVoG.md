---
id: task-3TW6gVoG
title: Fix global mutable counter and stale WebSocket closure
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-Dshzn6i-'
created: '2026-04-02T11:06:39.416Z'
updated: '2026-04-02T11:11:47.260Z'
sortIndex: 72
parent: task-Dshzn6i-
---
Two bugs to fix in the escalation chain frontend code:

1. **escalation-chain-editor.tsx (line 19)**: Replace the module-level `let chainKeyCounter = 0` with `useRef` or `React.useId()`. The current module-level variable is shared across all component instances, causing key collisions in concurrent editors and unbounded growth. Use `useRef(0)` inside the component to scope the counter per-instance, or `useId()` if unique string keys suffice.

2. **use-escalation-detail.ts (line 16)**: The WebSocket listener closure captures `id` at mount time. When navigating to a different escalation ID, the old listener stays active and silently targets the wrong record. Fix by either: (a) adding `id` to the useEffect dependency array so the listener re-registers on ID change (and clean up the old one), or (b) using a `useRef` for the current ID so the closure always reads the latest value.

Ensure both fixes maintain existing behavior — keys must still be unique within a single editor instance, and WebSocket updates must target the correct escalation after navigation.

---
**[2026-04-02 11:11:41]** 🚀 Fry started working on this task.
**[2026-04-02 11:11:41]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:11:47]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
