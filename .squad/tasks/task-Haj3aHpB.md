---
id: task-Haj3aHpB
title: 'Write tests for security headers, CSRF, and rate limiting'
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-NVCCV5oG'
created: '2026-04-02T02:05:21.479Z'
updated: '2026-04-02T02:05:21.483Z'
sortIndex: 602
parent: task-NVCCV5oG
dependsOn:
  - task-LOZ6ZDXy
---
In apps/api/src/routes/, write tests verifying the new security features:
1. **Helmet tests:** Send a GET /health request and assert response headers include X-Frame-Options, X-Content-Type-Options, Strict-Transport-Security, and Content-Security-Policy (or CSP-Report-Only).
2. **Rate limit tests:** Send 101+ requests to a route in quick succession and assert the 101st returns 429 Too Many Requests with a Retry-After header. Also test the stricter auth endpoint limit (11+ requests to POST /api/auth/login should get 429).
3. **CSRF tests:** (a) Send a POST request without a CSRF token and assert it returns 403. (b) Fetch a token from GET /api/csrf-token, then send a POST with the token and assert it succeeds (or gets past CSRF validation). (c) Verify GET requests are NOT blocked by CSRF.
Use the existing Vitest + Fastify inject() test pattern already used in the codebase. Run all tests with pnpm --filter api test.
