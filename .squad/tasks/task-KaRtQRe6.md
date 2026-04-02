---
id: task-KaRtQRe6
title: Split trace-detail.tsx into lazy-loaded sub-components
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-IRVBm65t'
created: '2026-04-02T11:09:06.773Z'
updated: '2026-04-02T11:11:56.642Z'
sortIndex: 89
parent: task-IRVBm65t
---
Refactor apps/web trace-detail.tsx (1040 lines) into three extracted sub-components: SpanTree, SpanSearch, and EventTimeline. Each should be its own file under the same directory. Then replace the inline usage in trace-detail.tsx with next/dynamic imports (with ssr: false where appropriate and loading skeletons). Also add route-level loading.tsx files for the traces, chat, and tasks pages to improve LCP. Ensure the existing terminal/page.tsx dynamic import pattern is followed for consistency.

---
**[2026-04-02 11:11:41]** 🚀 Fry started working on this task.
**[2026-04-02 11:11:41]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 11:11:56]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
