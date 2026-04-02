---
id: task-LOZ6ZDXy
title: 'Add helmet, CSRF protection, and rate limiting to Fastify API'
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-NVCCV5oG'
created: '2026-04-02T02:05:21.378Z'
updated: '2026-04-02T02:26:32.992Z'
sortIndex: 601
parent: task-NVCCV5oG
---
In apps/api:
1. Install @fastify/helmet, @fastify/rate-limit, and @fastify/csrf-protection via pnpm.
2. In apps/api/src/app.ts, register @fastify/helmet BEFORE other plugins (after Fastify instance creation ~line 100) with sensible defaults: CSP in report-only mode initially, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, HSTS enabled.
3. Register @fastify/rate-limit globally with a default of 100 requests/minute per IP. Add stricter limits (10 req/min) on auth endpoints (POST /api/auth/login, /api/auth/register, /api/auth/refresh) to prevent brute force.
4. Register @fastify/csrf-protection for POST/PATCH/DELETE routes. Add a GET /api/csrf-token endpoint that returns a CSRF token. Ensure GET/HEAD/OPTIONS are excluded from CSRF validation.
5. Make sure CORS config passes credentials: true so CSRF cookies work cross-origin.
6. Run typecheck (pnpm --filter api typecheck) and ensure existing tests still pass (pnpm --filter api test).

---
**[2026-04-02 02:14:12]** 🚀 Bender started working on this task.
**[2026-04-02 02:14:12]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:26:32]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
