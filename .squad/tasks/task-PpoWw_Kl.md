---
id: task-PpoWw_Kl
title: Test VoiceRoom auto-start effect fix
status: pending
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-i9lopsjI'
created: '2026-04-02T10:29:26.954Z'
updated: '2026-04-02T10:29:26.956Z'
sortIndex: 19
parent: task-i9lopsjI
dependsOn:
  - task-Adzaf16q
---
Verify the fix by: (1) confirming the `react-hooks/exhaustive-deps` lint rule passes without suppression in `voice-room.tsx`, (2) running existing tests to ensure no regressions, (3) adding or updating a test that validates `startListening` is called correctly when the effect re-fires due to a reference change — mock the upstream hook to return a new `startListening` reference and assert the latest version is invoked. Run the full lint and test suite.
