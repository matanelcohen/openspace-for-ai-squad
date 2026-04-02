---
id: task-UzEXczLC
title: Test AbortController integration
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-d3UsTeDu'
created: '2026-04-02T02:21:54.806Z'
updated: '2026-04-02T02:21:54.814Z'
sortIndex: 647
parent: task-d3UsTeDu
dependsOn:
  - task--JvIQfss
---
Write tests verifying: (1) apiClient passes the signal to fetch when provided, (2) apiClient works without a signal for backward compatibility, (3) useQuery hooks forward the signal from queryFn context, (4) useEffect-based fetches abort on unmount. Use vitest with MSW or fetch mocks. For the hook tests, use @testing-library/react renderHook and verify that navigating away (unmounting) triggers abort. Check that no 'Can't perform a React state update on an unmounted component' warnings appear. Run the full existing test suite to confirm no regressions.
