---
id: task-QXdNqAfl
title: Test auth enforcement and pagination limits
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-W8qSUffL'
created: '2026-04-02T02:04:48.103Z'
updated: '2026-04-02T02:04:48.108Z'
sortIndex: 600
parent: task-W8qSUffL
dependsOn:
  - task-hWQUSihZ
---
Write tests verifying: (1) `/api/terminal/ws` rejects unauthenticated WebSocket upgrades with 401, (2) `GET /api/memories` returns 401 without valid JWT, (3) all other API routes (agents, tasks, channels, knowledge, chat, etc.) return 401 without auth, (4) auth endpoints (`/api/auth/login`, `/api/auth/register`, etc.) and health checks remain accessible without auth, (5) memories pagination now caps at 100 (not 1000), matching knowledge endpoint. Use existing test patterns in the repo. The auth service supports `generateTokens()` for creating valid test JWTs.
