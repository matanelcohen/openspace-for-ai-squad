---
id: task-d7kQMX5f
title: 'Implement escalation engine, review queue, and audit trail backend'
status: done
priority: P1
assignee: bender
labels:
  - backend
  - api
  - websocket
  - database
  - hitl
  - 'parent:task-OpAaDISd'
created: '2026-03-25T23:19:55.030Z'
updated: '2026-03-26T00:47:01.354Z'
sortIndex: 159
---
Build the backend services for the HITL framework:
1. **Escalation Engine**: API to create escalation requests with configurable confidence thresholds. When an agent's confidence falls below the threshold, serialize workflow state and create a pending escalation. Support timeout-based auto-escalation and escalation chains (e.g., agent → reviewer → admin).
2. **Review Queue**: CRUD API for review queues — list pending escalations, claim/assign reviews, filter by priority/agent/workflow. Support WebSocket notifications for real-time queue updates.
3. **Approval/Rejection Flow**: Endpoints for approve, reject, and request-changes actions. On approval, deserialize workflow state and resume DAG execution. On rejection, trigger configurable rollback or alternative paths.
4. **Audit Trail**: Persist every escalation event (created, viewed, claimed, approved, rejected, timed-out) with timestamps, actor, rationale, and before/after snapshots. Expose query API for audit log retrieval with filtering and pagination.

---
**[2026-03-26 00:34:55]** 🚀 Bender started working on this task.

---
**[2026-03-26 00:38:30]** 🚀 Bender started working on this task.

---
**[2026-03-26 00:44:37]** 🚀 Bender started working on this task.

---
**[2026-03-26 00:47:01]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
