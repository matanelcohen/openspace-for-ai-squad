---
id: task-e8CqKnEB
title: Test VoiceSpeaker cleanup and unmount behavior
status: in-progress
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-fNCJA11L'
created: '2026-04-02T02:15:33.531Z'
updated: '2026-04-02T02:15:33.535Z'
sortIndex: 626
parent: task-fNCJA11L
dependsOn:
  - task-MzgxOuZB
---
Write or update tests for the VoiceSpeaker component to verify: (1) setTimeout IDs are cleared on unmount (no lingering timers), (2) rapid mount/unmount cycles don't cause state-update-on-unmounted-component warnings, (3) the useEffect with the fixed dependency array fires correctly when deps change. Use fake timers (vi.useFakeTimers) to assert clearTimeout is called during cleanup.
