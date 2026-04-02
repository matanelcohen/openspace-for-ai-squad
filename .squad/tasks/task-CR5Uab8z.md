---
id: task-CR5Uab8z
title: Test security headers and protocol enforcement
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-vkD0_s6e'
created: '2026-04-02T00:55:18.121Z'
updated: '2026-04-02T01:24:39.079Z'
sortIndex: 567
parent: task-vkD0_s6e
dependsOn:
  - task-A_ScXhwv
description: >
  Write tests to verify the security hardening changes:


  1. **Security headers test**: Write a test (or add to existing test suite)
  that verifies `next.config.mjs` exports the correct headers:
  `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options:
  nosniff`, `Strict-Transport-Security`, `Referrer-Policy`,
  `Permissions-Policy`.


  2. **api-client.ts tests**: Test that `getApiBaseUrl()` returns HTTPS URLs for
  non-localhost hosts, validates URLs with the URL constructor, and handles edge
  cases (missing env var, malformed env var, localhost vs remote).


  3. **terminal.tsx tests**: Test that `buildWsBase()` returns `wss:` for HTTPS
  pages, rejects malformed `NEXT_PUBLIC_API_URL` values gracefully, and
  validates host via URL constructor.


  Files to test: `apps/web/next.config.mjs`, `apps/web/src/lib/api-client.ts`,
  `apps/web/src/components/terminal/terminal.tsx`.



  ---

  **[2026-04-02 01:24:39]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
Write tests to verify the security hardening changes:

1. **Security headers test**: Write a test (or add to existing test suite) that verifies `next.config.mjs` exports the correct headers: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`.

2. **api-client.ts tests**: Test that `getApiBaseUrl()` returns HTTPS URLs for non-localhost hosts, validates URLs with the URL constructor, and handles edge cases (missing env var, malformed env var, localhost vs remote).

3. **terminal.tsx tests**: Test that `buildWsBase()` returns `wss:` for HTTPS pages, rejects malformed `NEXT_PUBLIC_API_URL` values gracefully, and validates host via URL constructor.

Files to test: `apps/web/next.config.mjs`, `apps/web/src/lib/api-client.ts`, `apps/web/src/components/terminal/terminal.tsx`.
