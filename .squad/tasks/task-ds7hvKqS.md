---
id: task-ds7hvKqS
title: Apply auth middleware globally to all API routes
status: pending
priority: P1
assignee: bender
labels:
  - 'parent:task-HjIALzBV'
created: '2026-04-02T01:33:26.612Z'
updated: '2026-04-02T01:41:56.562Z'
sortIndex: 582
parent: task-HjIALzBV
dependsOn:
  - task-L7ELin-E
description: >
  In `apps/api/src/app.ts`:


  1. **Register the auth middleware plugin** created in the previous subtask as
  a global Fastify plugin, applied before route registration

  2. **Configure the public route whitelist** to skip auth for:
     - `GET /health` and `GET /api/health` (health checks)
     - `GET /api/config` (public config)
     - `POST /api/auth/login` (login)
     - `POST /api/auth/register` (registration)
     - `POST /api/auth/refresh` (token refresh)
     - Any WebSocket upgrade paths if applicable
  3. **Remove the TODO comment** in `routes/channels.ts` line 14-17 since auth
  is now handled globally

  4. **Verify** that all 40+ protected routes (channels, escalations,
  team-members, tasks, chat, memories, knowledge, agents, decisions, etc.) are
  covered by the global middleware without needing per-route changes

  5. Ensure the auth middleware does NOT break the A2A routes or OTLP collector
  routes — check if those need special handling (e.g., API key auth instead of
  JWT)



  ---

  **[2026-04-02 01:41:56]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
In `apps/api/src/app.ts`:

1. **Register the auth middleware plugin** created in the previous subtask as a global Fastify plugin, applied before route registration
2. **Configure the public route whitelist** to skip auth for:
   - `GET /health` and `GET /api/health` (health checks)
   - `GET /api/config` (public config)
   - `POST /api/auth/login` (login)
   - `POST /api/auth/register` (registration)
   - `POST /api/auth/refresh` (token refresh)
   - Any WebSocket upgrade paths if applicable
3. **Remove the TODO comment** in `routes/channels.ts` line 14-17 since auth is now handled globally
4. **Verify** that all 40+ protected routes (channels, escalations, team-members, tasks, chat, memories, knowledge, agents, decisions, etc.) are covered by the global middleware without needing per-route changes
5. Ensure the auth middleware does NOT break the A2A routes or OTLP collector routes — check if those need special handling (e.g., API key auth instead of JWT)
