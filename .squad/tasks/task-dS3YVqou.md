---
id: task-dS3YVqou
title: 'Harden secrets, CORS, and Dockerfile'
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-gaGk__ph'
created: '2026-04-02T02:02:23.364Z'
updated: '2026-04-02T02:17:44.033Z'
sortIndex: 593
parent: task-gaGk__ph
---
Three changes:

1. **Startup config validation with Zod** — Install `zod` in `apps/api`. Create `apps/api/src/services/config/env.ts` that exports a validated env object. Schema must require `JWT_SECRET` and `CORS_ORIGIN` when `NODE_ENV=production` (can remain optional in dev). Import and call this validation at the top of `apps/api/src/index.ts` so the process crashes immediately on missing secrets.

2. **Remove JWT fallback** — In `apps/api/src/services/auth/index.ts` line 83, the constructor does `this.jwtSecret = opts.jwtSecret ?? process.env.JWT_SECRET ?? 'openspace-dev-secret'`. Remove the `'openspace-dev-secret'` fallback. Instead, if no secret is provided (both `opts.jwtSecret` and `process.env.JWT_SECRET` are undefined), throw an error: `throw new Error('JWT_SECRET is required')`. This pairs with the Zod validation but is also a defense-in-depth guard.

3. **CORS validation** — In `apps/api/src/app.ts` (~line 236), the CORS origin defaults to `'http://localhost:3000'`. Use the validated env object from step 1 so production requires an explicit `CORS_ORIGIN`.

4. **Dockerfile non-root user** — In the production stage of `Dockerfile`, before the `EXPOSE` line, add:
```dockerfile
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 --ingroup appgroup appuser && \
    chown -R appuser:appgroup /app
USER appuser
```
Make sure the HEALTHCHECK still works (curl needs to be available; install it in the runner stage if needed, or switch to a wget/node-based check).

---
**[2026-04-02 02:02:25]** 🚀 Bender started working on this task.
**[2026-04-02 02:02:25]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:17:44]** ❌ **BLOCKED** — bender failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
