---
id: task-pl10WDVm
title: Test code-split trace-detail and loading states
status: pending
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-IRVBm65t'
created: '2026-04-02T11:09:06.797Z'
updated: '2026-04-02T11:09:06.802Z'
sortIndex: 90
parent: task-IRVBm65t
dependsOn:
  - task-KaRtQRe6
---
After the frontend split is complete, verify: (1) Each extracted component (SpanTree, SpanSearch, EventTimeline) renders correctly in isolation and within trace-detail. (2) Dynamic imports actually produce separate chunks — check the build output with 'pnpm build' and confirm new chunk files exist. (3) The loading.tsx files render during navigation to traces, chat, and tasks routes. (4) No runtime errors or regressions in existing trace-detail functionality. (5) Run existing tests and add lightweight tests for the new loading.tsx components if a test pattern exists.
