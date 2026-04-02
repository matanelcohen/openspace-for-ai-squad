---
id: task-wVUOGfal
title: Test security hardening
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-gaGk__ph'
created: '2026-04-02T02:02:25.780Z'
updated: '2026-04-02T02:02:25.789Z'
sortIndex: 594
parent: task-gaGk__ph
dependsOn:
  - task-dS3YVqou
---
Verify all three security fixes:

1. **Missing JWT_SECRET fails loudly** — Write a test (or run manually) that starts the API without `JWT_SECRET` env var set and `NODE_ENV=production`. Confirm the process exits with a clear error message mentioning `JWT_SECRET`. Also verify that in development mode (no `NODE_ENV` or `NODE_ENV=development`), the app still starts (Zod schema should allow missing secrets in dev).

2. **CORS_ORIGIN required in production** — Confirm that starting with `NODE_ENV=production` and no `CORS_ORIGIN` fails with a validation error. Confirm that setting `CORS_ORIGIN=https://example.com` in production allows startup.

3. **Dockerfile runs as non-root** — Build the Docker image (`docker build -t openspace-test .`) and verify the container runs as `appuser` (not root). Run: `docker run --rm openspace-test whoami` — should output `appuser`. Also verify the health check still works.

4. **Existing tests still pass** — Run `pnpm test` (or the project's test command) to ensure no regressions from the auth/config changes.
