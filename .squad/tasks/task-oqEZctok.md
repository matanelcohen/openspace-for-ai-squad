---
id: task-oqEZctok
title: Test mutation error handling and double-submit prevention
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-t_xX4azF'
created: '2026-04-02T11:22:50.552Z'
updated: '2026-04-02T11:22:50.555Z'
sortIndex: 113
parent: task-t_xX4azF
dependsOn:
  - task-Zxq_fLlk
---
After the onError handlers are added, write tests covering: (1) Each mutation call site shows a toast on error — mock the mutation to reject and assert toast appears. (2) Buttons are disabled while isPending — trigger mutation, assert button is disabled, resolve mutation, assert button re-enables. (3) Optimistic state resets on error — e.g. setSaved resets in handleSave on failure. Cover all 3-4 affected files: workflows/compose/page.tsx, chat-client.tsx, workflows/[id]/page.tsx. Use the existing test framework (vitest + testing-library).
