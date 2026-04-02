---
id: task-L7ELin-E
title: Create JWT auth middleware plugin and harden secret
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-HjIALzBV'
created: '2026-04-02T01:33:25.636Z'
updated: '2026-04-02T02:09:07.523Z'
sortIndex: 581
parent: task-HjIALzBV
---
Three changes in apps/api/src:

1. **Create shared Fastify auth plugin** at `plugins/auth-middleware.ts`:
   - Export a Fastify plugin that adds a `preHandler` hook performing JWT verification via `AuthService.verifyAccessToken()`
   - Decorate the Fastify request with `user` (id, email, role from JWT payload)
   - Return 401 with `{error: 'Unauthorized'}` if token missing/invalid/expired
   - Accept a `skip` option listing route prefixes that bypass auth (e.g. `/health`, `/api/health`, `/api/config`, `/api/auth/login`, `/api/auth/register`, `/api/auth/refresh`)

2. **Harden JWT_SECRET** in `services/auth/index.ts` line 83:
   - Remove the `'openspace-dev-secret'` fallback entirely
   - In production (`NODE_ENV=production`), throw an error at startup if `JWT_SECRET` env var is not set
   - In development, allow a fallback but log a loud warning

3. **Register auth routes** in `app.ts`:
   - Import and register `authRoute` (currently missing from app.ts despite the file existing at `routes/auth.ts`)
   - Register under `/api` prefix like other routes

Reference files: `services/auth/index.ts` (AuthService with verifyAccessToken at line 212), `routes/auth.ts` (existing auth endpoints), `routes/channels.ts` line 14 (TODO pattern to follow), `app.ts` lines 518-546 (route registration).

---
**[2026-04-02 01:41:59]** 🚀 Bender started working on this task.
**[2026-04-02 01:41:59]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 01:42:12]** 🚀 Bender started working on this task.
**[2026-04-02 01:42:12]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 01:42:30]** 🚀 Bender started working on this task.
**[2026-04-02 01:42:30]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 01:43:22]** 🚀 Bender started working on this task.
**[2026-04-02 01:43:22]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 02:09:07]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
