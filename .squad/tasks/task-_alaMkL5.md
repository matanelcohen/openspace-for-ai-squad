---
id: task-_alaMkL5
title: Create error.tsx boundaries for critical routes
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-63HS6fKU'
created: '2026-04-02T10:31:26.779Z'
updated: '2026-04-02T11:04:57.982Z'
sortIndex: 28
parent: task-63HS6fKU
---
Add Next.js error.tsx boundary components at: (1) app/error.tsx as the global fallback, (2) app/settings/error.tsx for settings with destructive ops, (3) app/traces/error.tsx for traces, (4) app/chat/error.tsx for chat. Each error.tsx must be a 'use client' component that receives {error, reset} props. Show actionable recovery UI: display a user-friendly error message, a 'Try again' button that calls reset(), and a 'Go home' link. Style consistently with the existing app design system. The global fallback should be the most generic; route-specific ones can include context-appropriate messaging (e.g., 'Settings failed to load' vs 'Chat encountered an error').

---
**[2026-04-02 11:02:46]** 🚀 Fry started working on this task.
**[2026-04-02 11:02:46]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:04:57]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
