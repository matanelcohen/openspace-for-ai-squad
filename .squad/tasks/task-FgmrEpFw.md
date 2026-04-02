---
id: task-FgmrEpFw
title: Memoize getNextCronRuns and add cron validation UI
status: blocked
priority: P1
assignee: fry
labels:
  - 'parent:task-Byck8llE'
created: '2026-04-02T03:59:48.621Z'
updated: '2026-04-02T04:02:50.709Z'
sortIndex: 682
parent: task-Byck8llE
---
In `apps/web/app/cron/page.tsx`:

1. **Memoize `getNextCronRuns`**: The function (line 52-108) iterates up to 86,400 minutes per call. It's already wrapped in `useMemo` at lines 417 and 639, but both call sites create new computations for the same expression. Extract the function and add an LRU-style cache (e.g., a simple `Map<string, Date[]>` with size cap) so repeated calls with the same `expr+count` key return cached results instantly. Clear cache entries when the map exceeds ~50 entries.

2. **Add cron expression validation**: Currently invalid expressions silently return `[]`. Add a `validateCronExpression(expr: string): { valid: boolean; error?: string }` helper that checks: (a) exactly 5 space-separated fields, (b) each field contains only valid characters (`0-9`, `*`, `/`, `-`, `,`), (c) numeric values are within range for each field (minutes 0-59, hours 0-23, day 1-31, month 1-12, dow 0-6). Display validation errors inline below the schedule input in both the Create dialog and Edit dialog, using a red text style consistent with the existing UI patterns.

3. **Ensure `useMemo` dependency arrays are correct** at both call sites (lines 417-424 and 639-646).

---
**[2026-04-02 04:02:43]** 🚀 Fry started working on this task.
**[2026-04-02 04:02:43]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 04:02:50]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
