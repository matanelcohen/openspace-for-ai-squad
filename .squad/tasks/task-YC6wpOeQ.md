---
id: task-YC6wpOeQ
title: Add auth token headers to all frontend API calls
status: pending
priority: P0
assignee: fry
labels:
  - 'parent:task-8LsB9WUz'
created: '2026-04-02T10:54:46.223Z'
updated: '2026-04-02T10:54:46.239Z'
sortIndex: 53
parent: task-8LsB9WUz
dependsOn:
  - task-TL-2ju-t
---
Update the frontend HTTP client/fetch layer in apps/web to include the JWT/Bearer token in the Authorization header for every API request. Check how the frontend currently calls the API (likely via fetch, axios, or a shared API client). Add an interceptor or wrapper that reads the stored JWT (from localStorage, sessionStorage, or cookie) and attaches it as 'Authorization: Bearer <token>'. Handle 401 responses globally — redirect to login or show an auth error. Ensure WebSocket connections (used for real-time/chat) also pass the token during the handshake if applicable.
