---
id: task-OJZRkERx
title: Test auth middleware and secret hardening
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-HjIALzBV'
created: '2026-04-02T01:33:27.000Z'
updated: '2026-04-02T01:41:55.957Z'
sortIndex: 583
parent: task-HjIALzBV
dependsOn:
  - task-ds7hvKqS
description: >
  Write tests in `apps/api/src` (follow existing test patterns — likely vitest):


  1. **Unit tests for auth middleware plugin**
  (`plugins/auth-middleware.test.ts`):
     - Rejects requests with no Authorization header → 401
     - Rejects requests with malformed Bearer token → 401
     - Rejects requests with expired JWT → 401
     - Accepts requests with valid JWT and decorates request.user
     - Public routes (health, config, login, register, refresh) bypass auth

  2. **Integration tests for protected routes**:
     - Pick at least one endpoint from each critical group (channels, escalations, team-members) and confirm 401 without token and 200 with valid token
     - Test that `POST /api/escalations/:id/approve` requires auth
     - Test that `DELETE /api/escalation-chains/:id` requires auth
     - Test that `DELETE /api/team-members/:id` requires auth

  3. **Startup behavior tests** (`services/auth/index.test.ts` or similar):
     - With `NODE_ENV=production` and no `JWT_SECRET` → throws on construction
     - With `NODE_ENV=development` and no `JWT_SECRET` → warns but uses fallback
     - With `JWT_SECRET` set → uses provided secret in any environment

  4. **Run the full existing test suite** to confirm no regressions from the
  global middleware addition.



  ---

  **[2026-04-02 01:41:55]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
Write tests in `apps/api/src` (follow existing test patterns — likely vitest):

1. **Unit tests for auth middleware plugin** (`plugins/auth-middleware.test.ts`):
   - Rejects requests with no Authorization header → 401
   - Rejects requests with malformed Bearer token → 401
   - Rejects requests with expired JWT → 401
   - Accepts requests with valid JWT and decorates request.user
   - Public routes (health, config, login, register, refresh) bypass auth

2. **Integration tests for protected routes**:
   - Pick at least one endpoint from each critical group (channels, escalations, team-members) and confirm 401 without token and 200 with valid token
   - Test that `POST /api/escalations/:id/approve` requires auth
   - Test that `DELETE /api/escalation-chains/:id` requires auth
   - Test that `DELETE /api/team-members/:id` requires auth

3. **Startup behavior tests** (`services/auth/index.test.ts` or similar):
   - With `NODE_ENV=production` and no `JWT_SECRET` → throws on construction
   - With `NODE_ENV=development` and no `JWT_SECRET` → warns but uses fallback
   - With `JWT_SECRET` set → uses provided secret in any environment

4. **Run the full existing test suite** to confirm no regressions from the global middleware addition.
