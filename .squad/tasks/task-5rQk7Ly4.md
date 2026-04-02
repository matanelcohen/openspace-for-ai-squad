---
id: task-5rQk7Ly4
title: Wire AbortController cleanup into data-fetching hooks
status: pending
priority: P1
assignee: fry
labels:
  - 'parent:task-LevnH79_'
created: '2026-04-02T01:26:15.096Z'
updated: '2026-04-02T01:41:55.529Z'
sortIndex: 572
parent: task-LevnH79_
dependsOn:
  - task-lJM67VUs
description: >
  Update all data-fetching hooks (e.g. useQuery-style hooks, useEffect-based
  fetchers) to create an AbortController, pass its signal to apiClient(), and
  call controller.abort() in the useEffect cleanup function on component
  unmount. This prevents memory leaks and race conditions during rapid
  navigation. Check all hook call-sites across the frontend for consistency.



  ---

  **[2026-04-02 01:41:55]** ⚠️ Task was stuck in-progress after server restart.
  Reset to pending.
---
Update all data-fetching hooks (e.g. useQuery-style hooks, useEffect-based fetchers) to create an AbortController, pass its signal to apiClient(), and call controller.abort() in the useEffect cleanup function on component unmount. This prevents memory leaks and race conditions during rapid navigation. Check all hook call-sites across the frontend for consistency.
