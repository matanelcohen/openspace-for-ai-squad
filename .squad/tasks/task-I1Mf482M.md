---
id: task-I1Mf482M
title: 'Fix api-client.ts: don''t send Content-Type on bodiless requests'
status: done
priority: P0
assignee: fry
labels:
  - bug
  - frontend
  - api-client
  - 'parent:task-BPi8Kq1D'
created: '2026-03-25T14:02:52.667Z'
updated: '2026-03-25T14:46:36.907Z'
sortIndex: 63
---
In apps/web/src/lib/api-client.ts, the apiClient function unconditionally sets 'Content-Type: application/json' on every request (line 22). For DELETE (and GET) requests that have no body, this causes Fastify to return 400: 'Body cannot be empty when content-type is set to application/json'. Fix: only include the Content-Type header when options.body is present. This also fixes the api.delete helper which passes no body.
