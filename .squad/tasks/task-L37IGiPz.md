---
id: task-L37IGiPz
title: Implement path traversal guard in workspace file reads
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-4-4u7j2L'
created: '2026-04-02T10:37:49.020Z'
updated: '2026-04-02T11:06:17.754Z'
sortIndex: 38
parent: task-4-4u7j2L
---
In apps/api/src/routes/workspaces.ts (lines 130-145), readFileSync uses join(projectDir, name) without validating the resolved path stays within projectDir. Fix: (1) Replace join() with resolve() to canonicalize the path. (2) Use path.relative(projectDir, resolvedPath) and assert the result does not start with '..' before reading. (3) Return a 400/403 error if the path escapes the workspace directory. (4) Apply the same guard to any other file read/write operations in that file that take user-influenced filenames. This is a P1 security fix — keep the change minimal and surgical.

---
**[2026-04-02 11:03:00]** 🚀 Bender started working on this task.
**[2026-04-02 11:03:00]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:06:17]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
