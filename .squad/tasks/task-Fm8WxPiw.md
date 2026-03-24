---
id: task-Fm8WxPiw
title: Create team_members DB schema & API routes
status: backlog
priority: P0
assignee: bender
labels:
  - backend
  - database
  - API
  - CRUD
  - 'parent:task-ZOSFVe1k'
created: '2026-03-24T16:03:21.995Z'
updated: '2026-03-24T17:03:12.381Z'
sortIndex: 3
---
Add a `team_members` SQLite table (with FTS5 support) to the existing DB init in apps/api/. Create full CRUD REST routes at `/api/team-members` following the existing patterns in `routes/tasks.ts`. Endpoints: GET (list with filtering by department/status/rank), POST (create), GET /:id, PUT /:id (update), DELETE /:id, GET /:id/tasks (assigned tasks). Use the existing TeamMember type from packages/shared. Store directly in SQLite (not markdown files). Include proper validation and error handling.

---
**[2026-03-24 16:11:10]** 🚀 Bender started working on this task.

---
**[2026-03-24 16:13:32]** 🚀 Bender started working on this task.

---
**[2026-03-24 16:17:24]** 🚀 Bender started working on this task.

---
**[2026-03-24 16:17:25]** ❌ **BLOCKED** — bender failed.

**Error:** Request session.create failed with message: fetch failed

**Stack:** ```
Error: Request session.create failed with message: fetch failed
    at handleResponse (/Users/matancohen/microsoft/openspace-for-ai-squad/node_modules/.pnpm/vscode-jsonrpc@8.2.1/node_modules/vscode-jsonrpc/lib/common/connection.js:565:48)
    at handleMessage (/Users/matancohen/microsoft/openspace-f
```
