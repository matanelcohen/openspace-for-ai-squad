---
id: task-Idut62UB
title: Build trace storage API & endpoints
status: blocked
priority: P1
assignee: bender
labels:
  - backend
  - api
  - database
  - observability
  - 'parent:task-oJQ0IYQc'
created: '2026-03-25T23:19:09.235Z'
updated: '2026-03-26T00:25:17.309Z'
sortIndex: 141
---
Create backend API endpoints for trace data: (1) POST /api/traces - ingest trace data from the collector. (2) GET /api/traces - list traces with filters (agent, status, date range, cost threshold, latency threshold). (3) GET /api/traces/:id - get full trace with all spans in tree form. (4) GET /api/traces/stats - aggregated stats (avg latency, total cost, token usage over time, error rate). Add pagination, sorting, and efficient indexing for trace queries. Consider using a time-series friendly storage approach for high-volume trace data.

---
**[2026-03-26 00:18:44]** 🚀 Bender started working on this task.

---
**[2026-03-26 00:21:04]** 🚀 Bender started working on this task.

---
**[2026-03-26 00:22:28]** 🚀 Bender started working on this task.

---
**[2026-03-26 00:25:17]** 🛑 Permanently blocked after 3 failed attempts.

**Last known error:** Unknown — server likely crashed before error could be captured

**Diagnosis:** Task was found in-progress after server restart. The agent likely crashed or the copilot-sdk session failed. Check server logs for details.
