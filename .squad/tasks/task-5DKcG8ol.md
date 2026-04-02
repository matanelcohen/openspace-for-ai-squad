---
id: task-5DKcG8ol
title: Frontend form validation and ingestion refactor
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-9SacBWxs'
created: '2026-04-02T02:06:15.462Z'
updated: '2026-04-02T02:21:55.606Z'
sortIndex: 603
parent: task-9SacBWxs
---
In apps/web/app/cron/page.tsx: (1) Install Zod as a dependency in apps/web. (2) Create a Zod schema for the cron job form with: required string fields trimmed and non-empty for id/schedule/agent, max-length constraints (message: 5000, description: 2000, title: 200, agenda: 5000), cron expression validation using a regex or a lightweight cron parser, and participant agent IDs validated against the useAgents() hook's returned list. (3) Apply this schema in both handleSubmit functions (~L426 create and ~L648 edit) — parse with schema.safeParse(), show errors via toast/inline, and block mutation on failure. (4) In apps/web/src/components/knowledge/ingestion-status.tsx: refactor handleIngest (~L63) to replace the overlapping setInterval+dual setTimeout with a single useEffect-driven polling loop using AbortController. The useEffect should depend on an `ingesting` state flag, run a 3s poll interval, have a 120s max timeout, and return a cleanup function that clears both the interval and timeout so unmount is safe. Remove the duplicate 5s setTimeout entirely.

---
**[2026-04-02 02:06:15]** 🚀 Fry started working on this task.
**[2026-04-02 02:06:15]** 🎚️ Response tier: **full** — Full squad mobilization (maxAgents: 4)

---
**[2026-04-02 02:21:55]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
