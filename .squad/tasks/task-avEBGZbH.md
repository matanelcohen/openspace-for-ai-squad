---
id: task-avEBGZbH
title: Implement channel recipient resolver
status: blocked
priority: P1
assignee: bender
labels:
  - backend
  - messaging
  - channels
  - 'parent:task-TXBafNWA'
created: '2026-03-25T20:09:34.192Z'
updated: '2026-03-25T22:01:32.931Z'
sortIndex: 111
---
Add backend logic to detect `channel:<id>` recipient format in incoming messages. When a message targets a channel recipient, resolve it to the list of all current channel members by querying the channel membership data. Return the expanded list of user IDs so the message can be delivered to each member individually. Handle edge cases: non-existent channel, empty channel, sender not a member of the channel.

---
**[2026-03-25 22:01:32]** 🚀 Bender started working on this task.

---
**[2026-03-25 22:01:32]** ❌ **BLOCKED** — bender failed.

**Error:** this.broadcastAgentWorking is not a function

**Stack:** ```
TypeError: this.broadcastAgentWorking is not a function
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:269:12)
```
