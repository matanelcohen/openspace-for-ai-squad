---
id: task-a8yGYNwW
title: Test clipboard copy success and failure states
status: pending
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-wovP4gEb'
created: '2026-04-02T11:11:11.895Z'
updated: '2026-04-02T11:11:11.899Z'
sortIndex: 97
parent: task-wovP4gEb
dependsOn:
  - task-ClWczMir
---
Write or update tests for the CopyButton behavior in `trace-detail.tsx` and `tasks/[id]/page.tsx`:
1. Mock `navigator.clipboard.writeText` to resolve — verify the UI shows 'Copied!' and reverts after timeout
2. Mock `navigator.clipboard.writeText` to reject — verify the UI does NOT show 'Copied!' and instead shows an error cue/toast
3. Verify no unhandled promise rejections occur when clipboard access is denied
4. Check that rapid clicks don't produce inconsistent states

Use the existing test framework (Vitest + React Testing Library or Playwright as appropriate).
