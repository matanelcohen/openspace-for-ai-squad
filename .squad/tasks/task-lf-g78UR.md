---
id: task-lf-g78UR
title: Test polling optimization and cache behavior
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-Qormnc0C'
created: '2026-04-02T02:14:42.097Z'
updated: '2026-04-02T02:14:42.100Z'
sortIndex: 622
parent: task-Qormnc0C
dependsOn:
  - task-gfj3Xg3V
---
After the frontend changes land, verify: (1) Network tab shows dramatically reduced query traffic — no refetches within staleTime windows, (2) use-autopilot polls at 15s not 5s, (3) stale data is served from cache while revalidation happens in background, (4) gcTime correctly garbage-collects unused queries after 5 minutes, (5) WebSocket-driven invalidation triggers immediate refetch when events arrive, (6) no regressions in data freshness — UI still reflects updates within acceptable latency. Write or update existing tests to cover the new caching configuration.
