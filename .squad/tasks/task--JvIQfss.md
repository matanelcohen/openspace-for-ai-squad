---
id: task--JvIQfss
title: Add AbortController cleanup to critical useEffect hooks
status: in-progress
priority: P2
assignee: fry
labels:
  - 'parent:task-d3UsTeDu'
created: '2026-04-02T02:21:54.760Z'
updated: '2026-04-02T02:21:54.808Z'
sortIndex: 646
parent: task-d3UsTeDu
dependsOn:
  - task-ODhYvk7g
---
Identify all useEffect hooks that perform data fetching outside of useQuery/useMutation — particularly in chat, knowledge search, and settings mutation flows. For each one, create an AbortController in the effect body, pass controller.signal to the fetch/apiClient call, and return a cleanup function that calls controller.abort(). This prevents orphaned requests from racing to update unmounted component state. Focus on: chat streaming effects, knowledge search debounced effects, and any imperative fetch calls in settings pages.
