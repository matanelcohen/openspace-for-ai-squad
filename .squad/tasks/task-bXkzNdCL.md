---
id: task-bXkzNdCL
title: Replace dangerouslySetInnerHTML with React-based JSON highlighting
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-L8xCN_RD'
created: '2026-04-02T11:10:43.369Z'
updated: '2026-04-02T11:12:08.455Z'
sortIndex: 94
parent: task-L8xCN_RD
---
In trace-detail.tsx, find the SyntaxHighlightedJson component that currently uses regex-based syntax highlighting piped into dangerouslySetInnerHTML. Replace it with safe React-based rendering. Options: (1) Use react-syntax-highlighter with the 'json' language and a suitable theme, or (2) build a small recursive React component that tokenizes JSON and wraps keys/strings/numbers/booleans in styled <span> elements. Either way, remove ALL uses of dangerouslySetInnerHTML from this component. Ensure the visual output (colors, formatting) remains equivalent to the current implementation. Install any new dependencies (e.g. react-syntax-highlighter + @types/react-syntax-highlighter) via pnpm if needed.

---
**[2026-04-02 11:11:41]** 🚀 Fry started working on this task.
**[2026-04-02 11:11:41]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:12:08]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
