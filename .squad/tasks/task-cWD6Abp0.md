---
id: task-cWD6Abp0
title: Add security headers config in next.config.js
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-dLYeZD2w'
created: '2026-04-02T10:37:30.458Z'
updated: '2026-04-02T11:05:03.413Z'
sortIndex: 36
parent: task-dLYeZD2w
---
In the Next.js frontend (apps/web/next.config.js or next.config.ts), add a `headers()` async function that returns security headers for all routes ('/:path*'): X-Content-Type-Options: nosniff, X-Frame-Options: DENY, Strict-Transport-Security: max-age=31536000; includeSubDomains, Content-Security-Policy with a policy suitable for the frontend (allow 'self' for scripts/styles, restrict inline where possible — check layout.tsx for inline scripts that may need 'unsafe-inline' or nonces). Also add Referrer-Policy: strict-origin-when-cross-origin. Run `next build` to verify the config is valid.

---
**[2026-04-02 11:02:46]** 🚀 Fry started working on this task.
**[2026-04-02 11:02:46]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 11:05:03]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
