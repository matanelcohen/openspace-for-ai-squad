---
id: task-0pJDL_Iz
title: Fix N+1 fetches and add memoization across list pages
status: in-progress
priority: P2
assignee: fry
labels:
  - 'parent:task-c14GSoA7'
created: '2026-04-02T02:19:25.622Z'
updated: '2026-04-02T02:19:25.635Z'
sortIndex: 638
parent: task-c14GSoA7
dependsOn:
  - task-mCP4GVF3
---
Fix five frontend performance issues across list pages:
1. **skills/page.tsx**: Remove the duplicate unfiltered skill fetch used just to build an ID set — derive it from the already-fetched filtered list or combine into one call.
2. **decisions/page.tsx**: Replace the two parallel queries (all + search) with a single fetch + client-side filtering.
3. **team-members/[id]/page.tsx**: Switch from fetching all tasks to using the new server-side `?assignee=` filter on the tasks API.
4. **workflows/[id]/page.tsx ~L148**: Replace the O(n²) `.find()` inside `.map()` with a pre-built `Map<id, node>` for O(1) lookup.
5. **github/page.tsx ~L19**: Wrap the `linkedIssueNumbers` computation in `useMemo` with proper dependencies.
Ensure no regressions in UI behavior after each change.
