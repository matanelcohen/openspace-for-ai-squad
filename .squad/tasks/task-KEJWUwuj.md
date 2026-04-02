---
id: task-KEJWUwuj
title: Test VoiceSpeaker cleanup and timer behavior
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-gJkC2r4A'
created: '2026-04-02T10:28:31.729Z'
updated: '2026-04-02T10:28:31.734Z'
sortIndex: 15
parent: task-gJkC2r4A
dependsOn:
  - task-Hxx_q_tN
---
Write or update tests for VoiceSpeaker to verify: (1) All timers are cleared when the component unmounts mid-queue (use vi.useFakeTimers, mount, trigger TTS queue, unmount, assert no pending timers via vi.getTimerCount()). (2) The useEffect does not re-run on every render — spy on the effect body and confirm it only fires when deps change. (3) Rapid mount/unmount cycles don't leak timers. (4) Normal TTS playback still works end-to-end after the fix. Run the full test suite to confirm no regressions.
