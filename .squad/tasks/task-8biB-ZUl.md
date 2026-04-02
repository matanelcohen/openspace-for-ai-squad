---
id: task-8biB-ZUl
title: Test pagination endpoints and frontend integration
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-bpwheDT9'
created: '2026-04-02T02:23:17.410Z'
updated: '2026-04-02T02:23:17.484Z'
sortIndex: 650
parent: task-bpwheDT9
dependsOn:
  - task-YDbxssX0
---
Write and run tests verifying server-side pagination works correctly for cron and memories endpoints, and that debounce prevents excessive API calls.

**API tests** (add to existing test files or create new ones near the route files):
1. `GET /api/cron?limit=10&offset=0` — returns exactly 10 jobs (or fewer if total < 10) plus `total` count
2. `GET /api/cron?limit=10&offset=10` — returns next page, no overlap with first page
3. `GET /api/cron` (no params) — returns default page size (50), not unbounded
4. `GET /api/memories?limit=5&offset=0` — returns 5 memories plus total
5. Edge cases: offset beyond total returns empty array with correct total; limit=0 or negative uses defaults; limit > 100 clamped to 100
6. `POST /api/memories/search` with limit/offset in body — respects pagination

**Frontend tests** (if vitest/testing-library tests exist):
1. Test `useDebouncedValue` hook — value only updates after 300ms delay
2. Test that search input on skills page doesn't trigger immediate API call
3. Test pagination controls show correct page info and navigate correctly

**Check existing test infrastructure**: Look for test files in `e2e/`, `apps/web/**/*.test.*`, `apps/api/**/*.test.*`. Use `vitest` (confirmed by `vitest.config.ts` at root). Run existing tests first to establish baseline: `pnpm test` or `pnpm vitest run`.

**Verify no regressions**: Run the full test suite after changes and confirm all existing tests still pass.
