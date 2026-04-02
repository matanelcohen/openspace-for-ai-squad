---
id: task-S-debNTQ
title: Test security headers on both API and frontend
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-dLYeZD2w'
created: '2026-04-02T10:37:30.469Z'
updated: '2026-04-02T10:37:30.473Z'
sortIndex: 37
parent: task-dLYeZD2w
dependsOn:
  - task-AWAzXQH6
  - task-cWD6Abp0
---
Write integration/e2e tests verifying that both the Fastify API and Next.js frontend return the required security headers. For the API: add a test in the existing API test suite that makes a request to any endpoint and asserts X-Content-Type-Options, X-Frame-Options, Content-Security-Policy, and Strict-Transport-Security are present with correct values. For the frontend: add a Playwright or similar e2e test that fetches the homepage and asserts the same headers. Ensure all existing tests still pass.
