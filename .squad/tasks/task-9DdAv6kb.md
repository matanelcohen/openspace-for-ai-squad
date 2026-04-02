---
id: task-9DdAv6kb
title: Add tests for TTS error handling and abort patterns
status: in-progress
priority: P2
assignee: zoidberg
labels:
  - 'parent:task-uGx1Kkl-'
created: '2026-04-02T02:14:31.407Z'
updated: '2026-04-02T02:14:31.411Z'
sortIndex: 620
parent: task-uGx1Kkl-
dependsOn:
  - task-qFFJ8fG_
---
After the frontend changes land, write tests covering:
1. synth.speak() throwing — verify the error propagates to the onError callback and the queue continues processing remaining items.
2. Browser capability missing (mock speechSynthesis as undefined or getVoices returning empty) — verify graceful degradation and parent notification.
3. Unmount during active speech — verify setTimeout is cleared (no warnings, no state updates after unmount).
4. Abort/cancel mid-queue — verify synth.cancel() is called, queue is flushed, and component returns to idle state.
5. Mid-session API revocation — simulate speechSynthesis becoming unavailable between queued items.
Use the existing test framework (vitest + testing-library). Mock window.speechSynthesis and SpeechSynthesisUtterance.
