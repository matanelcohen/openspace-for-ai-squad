---
id: task-qBZ8hPR2
title: Add pagination UI and server-side data fetching to TraceList
status: pending
priority: P1
assignee: fry
labels:
  - 'parent:task-k-Ddbr6S'
created: '2026-04-02T10:44:02.188Z'
updated: '2026-04-02T10:44:02.191Z'
sortIndex: 48
parent: task-k-Ddbr6S
dependsOn:
  - task-3Ffl2b_w
---
Update the TraceList frontend to consume the new paginated API and add pagination controls.

**Hook (`apps/web/src/hooks/use-traces.ts`):**
- Update `useTraces()` to accept `{ page, limit, status, agent, search, sort, sortDir }` params
- Change queryKey to include all params so React Query caches per-page
- Update queryFn to pass `offset = page * limit` plus filters as query params
- Update return type to expect `{ data: TraceSummary[], total, limit, offset }` envelope

**Component (`apps/web/src/components/traces/trace-list.tsx`):**
- Add `page` state (default 0) and `pageSize` constant (50)
- Pass `statusFilter`, `agentFilter`, `search`, `sortField`, `sortDir` to the updated `useTraces()` hook so filtering/sorting happens server-side
- Remove the client-side `useMemo` filter+sort block (lines ~136–176) — the API now handles this
- Keep the summary stats row but derive counts from the API response (`total` for total, and current page data for running/error counts — or add a separate lightweight stats endpoint if needed)
- Add pagination controls (Previous / Next buttons + page indicator like 'Page 1 of 20') below the table
- Disable Previous on page 0, disable Next when `(page + 1) * pageSize >= total`
- Reset page to 0 when any filter, search, or sort changes
- Show loading skeleton during page transitions (useTraces `isLoading` or `isFetching`)

**Reference:** Follow existing UI patterns in the codebase for button styling. The API envelope matches the chat messages pattern.
