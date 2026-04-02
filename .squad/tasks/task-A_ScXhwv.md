---
id: task-A_ScXhwv
title: Add security headers and enforce HTTPS in API client
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-vkD0_s6e'
created: '2026-04-02T00:55:18.021Z'
updated: '2026-04-02T01:26:54.027Z'
sortIndex: 566
parent: task-vkD0_s6e
---
Three changes needed:

1. **next.config.mjs** (`apps/web/next.config.mjs`): Add a `Content-Security-Policy` header with appropriate directives (default-src 'self', script-src, style-src, connect-src for API/WS, img-src). Also add `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` header.

2. **api-client.ts** (`apps/web/src/lib/api-client.ts`): The fallback URL construction should enforce protocol matching — if `window.location.protocol` is `https:`, the API URL must use `https:`. Use the `URL` constructor to validate the final URL rather than raw string concatenation. Remove or tighten the localhost exception so non-localhost hosts always use HTTPS.

3. **terminal.tsx** (`apps/web/src/components/terminal/terminal.tsx`): In `buildWsBase()`, validate the host value extracted from `NEXT_PUBLIC_API_URL` by parsing it through `new URL()` constructor. Ensure the WebSocket URL cannot be constructed with an untrusted host. If URL parsing fails, fall back to `window.location.host` safely.

---
**[2026-04-02 00:55:18]** 🚀 Bender started working on this task.
**[2026-04-02 00:55:18]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 01:26:54]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
