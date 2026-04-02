---
id: task-A9cOD8mO
title: Add test for VoiceSpeaker onQueueEmpty firing behavior
status: pending
priority: P1
assignee: zoidberg
labels:
  - 'parent:task-1b06P6JT'
created: '2026-04-02T11:07:54.507Z'
updated: '2026-04-02T11:07:54.516Z'
sortIndex: 83
parent: task-1b06P6JT
dependsOn:
  - task-KMApkQlm
---
Write a test (vitest + React Testing Library) for the `VoiceSpeaker` component verifying that `onQueueEmpty` is called exactly once when the queue drains from non-empty to empty, and is NOT called on every render. Mock the audio context and queue, render the component multiple times, and assert the callback invocation count. This validates the dependency array fix and prevents regression.
