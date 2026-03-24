---
id: task-RvrTeL1q
title: Build Team Members UI pages & components
status: backlog
priority: P0
assignee: fry
labels:
  - frontend
  - UI
  - React
  - pages
  - components
  - 'parent:task-ZOSFVe1k'
created: '2026-03-24T16:03:21.997Z'
updated: '2026-03-24T17:03:14.207Z'
sortIndex: 4
---
Create the HR Department frontend under `apps/web/app/team-members/`. Build: (1) List page with table/grid view showing all members with search, filter by department/status/rank, and sort. (2) Member detail page at `[id]/page.tsx` showing profile, assigned tasks, and rank. (3) Create/Edit form dialog (TeamMemberFormDialog) using Radix UI + Tailwind, matching existing task-form-dialog patterns. (4) Member card component for grid view. (5) Add 'Team' or 'HR' entry to the sidebar navigation in `app-layout`. Use React Query hooks pattern from `use-tasks.ts` to create `use-team-members.ts` with queries and CRUD mutations.

---
**[2026-03-24 16:11:12]** 🚀 Fry started working on this task.

---
**[2026-03-24 16:13:32]** 🚀 Fry started working on this task.

---
**[2026-03-24 16:17:24]** 🚀 Fry started working on this task.

---
**[2026-03-24 16:17:25]** ❌ **BLOCKED** — fry failed.

**Error:** Request session.create failed with message: fetch failed

**Stack:** ```
Error: Request session.create failed with message: fetch failed
    at handleResponse (/Users/matancohen/microsoft/openspace-for-ai-squad/node_modules/.pnpm/vscode-jsonrpc@8.2.1/node_modules/vscode-jsonrpc/lib/common/connection.js:565:48)
    at handleMessage (/Users/matancohen/microsoft/openspace-f
```
