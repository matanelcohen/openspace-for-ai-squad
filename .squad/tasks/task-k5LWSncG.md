---
id: task-k5LWSncG
title: Test AbortController cleanup and unmount safety
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-Ju5sMdl8'
created: '2026-04-02T11:15:10.274Z'
updated: '2026-04-02T11:15:10.278Z'
sortIndex: 104
parent: task-Ju5sMdl8
dependsOn:
  - task-cCXwwkRE
---
Write or update tests covering both fixes:

1. **use-voice-session.ts**: Test that unmounting the hook during a pending `/api/voice/speak` fetch aborts the request (mock fetch, verify `signal.aborted` is true) and does not update state after unmount.

2. **workflows/compose/page.tsx**: Test that unmounting the component before the 1s redirect fires cancels the timeout — `router.push` should NOT be called. Also test the happy path: when the component stays mounted after save, `router.push` fires after ~1s.

Ensure all existing tests still pass.
