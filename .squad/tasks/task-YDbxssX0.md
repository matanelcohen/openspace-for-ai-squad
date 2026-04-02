---
id: task-YDbxssX0
title: Add paginated React Query hooks and debounced search inputs
status: in-progress
priority: P2
assignee: fry
labels:
  - 'parent:task-bpwheDT9'
created: '2026-04-02T02:23:17.350Z'
updated: '2026-04-02T02:23:17.466Z'
sortIndex: 649
parent: task-bpwheDT9
dependsOn:
  - task-qin9q1Tx
---
Update the frontend hooks and pages for cron and memories to support server-side pagination, and add 300ms debounce to all search inputs.

**Reference implementation**: `apps/web/src/hooks/use-skill-gallery.ts` lines 54-73 — shows pagination filter interface with limit/offset params and `{ items: T[], total: number }` response.

**Hook updates**:
1. `apps/web/src/hooks/use-cron.ts` — Update `useCronJobs()` and `useCronExecutions()` to accept `{ limit?: number, offset?: number }` params. Pass as query params to API. Return type changes to `{ jobs: CronJob[], total: number }`. Consider using `useInfiniteQuery` or offset-based pagination with page state.
2. `apps/web/src/hooks/use-memories.ts` — Update `useMemories()` similarly. Accept `{ limit?: number, offset?: number }`. Return `{ memories: Memory[], total: number }`.

**Page updates**:
1. `apps/web/app/cron/page.tsx` (777 lines) — Remove any `.slice()` band-aids. Add pagination controls (prev/next buttons or infinite scroll). Track current page/offset in state. Pass to updated hooks.
2. `apps/web/app/skills/page.tsx` (151 lines) — The `search` state directly drives `useSkills(filters)` queries on every keystroke. Add a 300ms debounce: use a `useDebouncedValue` hook (create one in `apps/web/src/hooks/` if none exists) so the API call only fires after 300ms of no typing. Apply same debounce to any search input on cron page.
3. Add a simple pagination UI component (or inline prev/next + page info) showing 'Page X of Y' with navigation.

**Debounce pattern**:
```typescript
const [search, setSearch] = useState('');
const debouncedSearch = useDebouncedValue(search, 300);
const { data } = useSkills({ search: debouncedSearch });
```

**Files to modify**:
- `apps/web/src/hooks/use-cron.ts`
- `apps/web/src/hooks/use-memories.ts`
- `apps/web/app/cron/page.tsx`
- `apps/web/app/skills/page.tsx`
- New: `apps/web/src/hooks/use-debounce.ts` (if not existing)
