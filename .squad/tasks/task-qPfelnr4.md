---
id: task-qPfelnr4
title: Replace unsafe casts in frontend hooks with Zod-validated parsing
status: pending
priority: P1
assignee: fry
labels:
  - 'parent:task-51Xq8ArW'
created: '2026-04-02T11:08:41.984Z'
updated: '2026-04-02T11:08:41.987Z'
sortIndex: 85
parent: task-51Xq8ArW
dependsOn:
  - task-i18a51xn
---
After the Zod schemas and validated api-client are in place, update use-cron.ts and any other frontend query hooks that chain unsafe 'as Record<string, unknown>' or 'as T' casts. Import the Zod schemas created by Bender and pass them to the validated fetch wrapper. Remove all unsafe type assertions from query functions for cron executions, tasks, and escalations. Ensure React Query hooks surface Zod validation errors properly (e.g., via the error state) so the UI shows meaningful feedback instead of silently rendering undefined values.
