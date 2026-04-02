---
id: task-qFFJ8fG_
title: Implement TTS error handling and cleanup in voice-speaker.tsx
status: blocked
priority: P2
assignee: fry
labels:
  - 'parent:task-uGx1Kkl-'
created: '2026-04-02T02:14:31.375Z'
updated: '2026-04-02T02:55:53.731Z'
sortIndex: 619
parent: task-uGx1Kkl-
---
In apps/web voice-speaker.tsx:
1. Wrap every synth.speak() call in try/catch — on error, remove the utterance from the queue and propagate the error to the parent via an onError callback prop.
2. Add a browser capability check (window.speechSynthesis availability + getVoices() length) before each speak call to handle mid-session API revocation; if unavailable, skip and notify parent.
3. Replace the raw setTimeout safety timeout with a useRef-based pattern: store the timer ID in a ref, clear it on every new speak and in the useEffect cleanup/unmount return. This prevents leaked timers and state-updates-on-unmounted-component warnings.
4. Add an AbortController or equivalent cancellation mechanism so the parent can call abort() to flush the queue and cancel the current utterance (synth.cancel()).
5. Ensure all error paths update the queue state consistently so subsequent messages still play.

---
**[2026-04-02 02:27:30]** 🚀 Fry started working on this task.
**[2026-04-02 02:27:30]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-04-02 02:55:53]** ❌ **BLOCKED** — fry failed.

**Error:** Max sandboxes (10) reached.

**Stack:** ```
Error: Max sandboxes (10) reached.
    at WorktreeService.create (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/sandbox-worktree/index.ts:93:13)
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:985:30)
```
