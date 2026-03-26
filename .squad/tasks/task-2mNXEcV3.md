---
id: task-2mNXEcV3
title: Add tests for channel message routing
status: blocked
priority: P1
assignee: zoidberg
labels:
  - testing
  - unit-tests
  - integration-tests
  - channels
  - 'parent:task-TXBafNWA'
created: '2026-03-25T20:09:34.240Z'
updated: '2026-03-25T22:01:25.029Z'
sortIndex: 114
---
Write unit tests for the channel recipient resolver: valid channel, non-existent channel, empty channel, sender not a member. Write integration tests for the full routing pipeline: send a message to `channel:<id>`, verify all members receive it via WebSocket, verify message is persisted, verify offline members can retrieve it later. Include a test for multiple concurrent channel messages to catch race conditions.

---
**[2026-03-25 22:01:24]** 🚀 Zoidberg started working on this task.

---
**[2026-03-25 22:01:25]** ❌ **BLOCKED** — zoidberg failed.

**Error:** this.broadcastAgentWorking is not a function

**Stack:** ```
TypeError: this.broadcastAgentWorking is not a function
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:269:12)
```
