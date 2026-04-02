---
id: task-K3XZEWuJ
title: Add file upload validation to attachment handler
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-DylQFu5h'
created: '2026-04-02T02:07:01.458Z'
updated: '2026-04-02T02:22:24.663Z'
sortIndex: 609
parent: task-DylQFu5h
---
In the Knowledge page attachment handler (apps/web, likely `attachment.tsx` around lines 30-63), add client-side validation before creating Object URLs:
1. Define `MAX_FILE_SIZE = 10 * 1024 * 1024` (10MB) and `ALLOWED_TYPES` allowlist (e.g. 'application/pdf', 'text/plain', 'text/markdown', 'image/png', 'image/jpeg', common doc types).
2. Before the Object URL creation, check `file.size <= MAX_FILE_SIZE` and `ALLOWED_TYPES.includes(file.type)`.
3. Show a user-facing toast/error when validation fails (file too large or unsupported type).
4. Revoke any existing Object URLs on cleanup to prevent memory leaks.
Export the constants so tests can reference them.

---
**[2026-04-02 02:07:01]** 🚀 Fry started working on this task.
**[2026-04-02 02:07:01]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:22:24]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
