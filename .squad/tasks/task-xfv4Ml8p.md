---
id: task-xfv4Ml8p
title: Test lazy-loaded markdown rendering
status: pending
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-VcyK2556'
created: '2026-04-02T11:03:09.023Z'
updated: '2026-04-02T11:03:09.025Z'
sortIndex: 64
parent: task-VcyK2556
dependsOn:
  - task-qyfccSIJ
---
After the lazy-loading refactor is complete, verify correctness and performance:
1. Run existing tests (`pnpm test` in apps/web) and fix any broken imports referencing the old direct MarkdownText import path.
2. Write or update a test for the lazy-loaded MarkdownText: confirm the skeleton fallback renders initially, then the full markdown content renders after the dynamic import resolves.
3. Manually verify (or add an e2e test) that GFM features (tables, strikethrough, task lists) still render correctly in both `markdown-text.tsx` usage sites and `task-form-dialog.tsx`.
4. Compare `pnpm build` output before and after — confirm remark-gfm and its deps moved out of the shared/initial JS chunks into a separate lazy chunk, reducing first-load JS.
