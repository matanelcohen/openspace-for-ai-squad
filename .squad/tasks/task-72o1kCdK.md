---
id: task-72o1kCdK
title: Build review queue UI and approval/rejection workflow screens
status: done
priority: P2
assignee: fry
labels:
  - frontend
  - ui
  - dashboard
  - hitl
  - 'parent:task-OpAaDISd'
created: '2026-03-25T23:19:55.044Z'
updated: '2026-03-31T21:51:04.879Z'
sortIndex: 107
---
Create the frontend for human reviewers:
1. **Review Queue Dashboard**: Filterable, sortable list of pending escalations showing agent name, workflow context, confidence score, priority, and time waiting. Real-time updates via WebSocket.
2. **Escalation Detail View**: Display the full context snapshot — what the agent was doing, why it escalated, confidence score, and any agent-provided rationale. Show diff/preview of proposed action.
3. **Approval/Rejection Controls**: Approve, reject, or request-changes buttons with required rationale text field. Support bulk actions for batch reviews.
4. **Audit Trail Viewer**: Timeline view of all escalation events for a given workflow, with expandable details.
5. **Threshold Configuration UI**: Admin screen to configure confidence thresholds per agent type, workflow, or node — with sensible defaults and validation.

---
**[2026-03-26 00:22:28]** 🚀 Fry started working on this task.

---
**[2026-03-26 00:25:17]** 🚀 Fry started working on this task.

---
**[2026-03-26 00:27:14]** 🚀 Fry started working on this task.

---
**[2026-03-26 00:34:15]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
