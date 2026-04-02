---
id: task-JPBuShkM
title: Test error feedback on all patched mutation call sites
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-e0QwUbtd'
created: '2026-04-02T11:06:08.474Z'
updated: '2026-04-02T11:06:08.479Z'
sortIndex: 68
parent: task-e0QwUbtd
dependsOn:
  - task-OsMOCOd6
---
Write tests for each of the 5+ mutation call sites that were patched to verify error handling works:
1. `traces/page.tsx` handleClearAll — mock the mutation to reject and assert a toast/error message appears.
2. `escalation-detail-panel.tsx` handleClaim — mock failure and assert onError toast fires.
3. `escalation-detail-panel.tsx` handleApprove — mock failure and assert onError toast fires.
4. `chat-client.tsx` handleSaveChannel — mock failure and assert the dialog shows an error (not silently stays open).
5. `skills/gallery/[id]/page.tsx` handleInstall — mock failure and assert toast appears instead of empty catch.

Each test should simulate a network/server error on the mutation, then assert that visible user feedback (toast notification or inline error message) is rendered. Use the existing test framework (Vitest + React Testing Library). Run the full test suite to confirm no regressions.
