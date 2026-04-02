---
id: task-UvveyZQz
title: Test setTimeout cleanup prevents memory leaks
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-nqY5GIFV'
created: '2026-04-02T10:30:55.709Z'
updated: '2026-04-02T10:30:55.723Z'
sortIndex: 24
parent: task-nqY5GIFV
dependsOn:
  - task-q_ZlDwAb
---
Write or update tests for both pages to verify timeout cleanup:

1. For `workflows/compose/page.tsx`: Mount the component, then unmount before the timeout fires. Assert that `clearTimeout` was called and no setState warnings appear.

2. For `team-members/[id]/page.tsx`: Same pattern — mount, unmount early, verify cleanup.

Use `vi.useFakeTimers()` to control timing. Spy on `clearTimeout` to verify it's called on unmount. Check the console for React setState-on-unmounted-component warnings.
