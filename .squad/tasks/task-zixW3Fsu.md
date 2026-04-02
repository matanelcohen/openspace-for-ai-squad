---
id: task-zixW3Fsu
title: Replace index keys with stable keys in all three components
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-2qrpeOQO'
created: '2026-04-02T02:15:49.550Z'
updated: '2026-04-02T02:56:49.967Z'
sortIndex: 627
parent: task-2qrpeOQO
---
In apps/web, update the following files to replace key={index} with content-derived stable keys in all .map() calls:

1. **search-highlight.tsx** — Find .map() calls using key={index}. Use a composite key derived from the content part and its index (e.g., `key={`${part.text}-${i}`}` or a hash of the segment content) so that highlight segments reconcile correctly.

2. **decision-card.tsx** — Find .map() calls using key={index}. Use a stable identifier from the data being rendered (e.g., decision ID, option ID, or a composite of meaningful fields).

3. **squad-init-wizard.tsx** — Find .map() calls using key={index}. Use stable identifiers from the wizard step data or agent data being iterated (e.g., agent name, step ID, or file path).

For each fix:
- Grep the file for `key={index}` or similar patterns (key={i}, key={idx})
- Examine what data is available in each .map() callback to derive a stable key
- Replace with the most semantically meaningful stable key available
- Ensure no duplicate keys are possible
- Run the TypeScript compiler (`pnpm tsc --noEmit` or equivalent) to verify no type errors are introduced

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:56:49]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
