---
id: task-pv2XbQ0l
title: 'Add SLA Tracking, Analytics Endpoints, and Notification Service'
status: blocked
priority: P2
assignee: bender
labels:
  - 'parent:task-OpAaDISd'
created: '2026-03-30T14:40:26.550Z'
updated: '2026-03-30T14:58:48.247Z'
sortIndex: 229
parent: task-OpAaDISd
---
Enhance the backend HITL escalation service in apps/api with: (1) SLA tracking — add sla_deadline_at column to the escalations table (computed from chain level timeout on creation/escalation), add a GET /api/escalations/sla-breaches endpoint returning items approaching or past SLA, wire the existing POST /api/escalations/check-timeouts into the cron route for periodic auto-escalation processing, (2) Analytics/metrics endpoints — add GET /api/escalations/stats returning aggregate metrics (avg resolution time, approval/rejection rates, escalations by priority, SLA compliance percentage, queue depth over time), GET /api/escalations/reviewer-stats/:reviewerId for per-reviewer metrics, (3) Reviewer notification service — create a notification service in apps/api/src/services/notifications/ that sends WebSocket notifications to specific reviewers when they're eligible for new escalations (use isReviewerEligible from the shared escalation engine), add a notifications table for persistence, and expose GET /api/notifications and POST /api/notifications/:id/read endpoints. Build on the existing escalation service at apps/api/src/services/escalation/index.ts and routes at apps/api/src/routes/escalations.ts. Use the pure functions from @openspace/shared escalation module.

---
**[2026-03-30 14:40:37]** 🚀 Bender started working on this task.
**[2026-03-30 14:40:37]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-30 14:43:01]** 🚀 Bender started working on this task.
**[2026-03-30 14:43:01]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-30 14:47:14]** 🚀 Bender started working on this task.
**[2026-03-30 14:47:14]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-30 14:50:12]** 🚀 Bender started working on this task.
**[2026-03-30 14:50:12]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-30 14:56:32]** 🚀 Bender started working on this task.
**[2026-03-30 14:56:32]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-30 14:58:48]** 🛑 Permanently blocked after 5 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
