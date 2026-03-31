---
id: task-hrViAwMc
title: Persist kanban filter state in URL search params
status: pending
priority: P2
assignee: fry
labels:
  - feature
  - ux
  - kanban
  - filters
  - 'parent:task-XGIIS5pk'
created: '2026-03-31T13:01:34.357Z'
updated: '2026-03-31T13:01:34.357Z'
sortIndex: 328
---
Persist the active kanban filters (status, priority, assignee, search) in URL query parameters so filters survive page refreshes and can be shared via URL. Use Next.js `useSearchParams` + `useRouter` to sync filter state with the URL. Initialize filters from URL params on mount. This ensures a consistent UX with the list view and supports bookmarkable filtered views.
