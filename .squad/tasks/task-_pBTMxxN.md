---
id: task-_pBTMxxN
title: Add request validation and error handling for channel endpoints
status: blocked
priority: P1
assignee: bender
labels:
  - backend
  - api
  - validation
  - 'parent:task-Te0mqldK'
created: '2026-03-25T20:09:17.103Z'
updated: '2026-03-25T22:01:30.952Z'
sortIndex: 108
---
Implement request validation for channel API inputs:
- POST /api/channels: validate required 'name' field, optional 'description', enforce max lengths
- PUT /api/channels/:id: validate at least one updatable field is present
- GET/DELETE /api/channels/:id: validate ':id' is a valid format (e.g., UUID)

Create consistent error response format ({ error, message, details }) and ensure validation errors return 400, not-found returns 404, and server errors return 500. Reuse or extend existing validation/error middleware if present.

---
**[2026-03-25 22:01:30]** 🚀 Bender started working on this task.

---
**[2026-03-25 22:01:30]** ❌ **BLOCKED** — bender failed.

**Error:** this.broadcastAgentWorking is not a function

**Stack:** ```
TypeError: this.broadcastAgentWorking is not a function
    at AgentWorkerService.processNext (/Users/matancohen/microsoft/openspace-for-ai-squad/apps/api/src/services/agent-worker/index.ts:269:12)
```
