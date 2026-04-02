---
id: task-F_HacHaW
title: Replace dangerouslySetInnerHTML with safe rendering in trace-detail.tsx
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-dtKSjadt'
created: '2026-04-02T02:12:53.788Z'
updated: '2026-04-02T02:56:03.663Z'
sortIndex: 614
parent: task-dtKSjadt
---
In apps/web, open trace-detail.tsx and find the SyntaxHighlightedJson component. It currently escapes HTML then applies regex replacements to inject <span> tags via dangerouslySetInnerHTML — this is an XSS vector because regex replacement patterns ($&, $`) in attacker-controlled trace data can break out of span attributes. Replace the entire dangerouslySetInnerHTML approach with react-syntax-highlighter (already in package.json) using the 'json' language and an appropriate theme (e.g. vscDarkPlus or oneLight depending on existing app theme). If react-syntax-highlighter doesn't fit the UI needs, alternatively build DOM nodes safely using React.createElement with textContent (never innerHTML). Also add an ESLint rule in eslint.config.mjs to flag any future dangerouslySetInnerHTML usage — use 'no-restricted-syntax' or the existing react/no-danger rule. Ensure the fix preserves the current visual appearance of JSON syntax highlighting in the trace detail view.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 02:56:03]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
