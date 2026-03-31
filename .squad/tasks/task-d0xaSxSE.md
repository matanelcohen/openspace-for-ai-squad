---
id: task-d0xaSxSE
title: Create TeamStatusService and wire into agent worker
status: blocked
priority: P1
assignee: bender
labels:
  - 'parent:task-FFwWA83J'
created: '2026-03-31T22:18:51.866Z'
updated: '2026-03-31T22:41:21.453Z'
sortIndex: 350
parent: task-FFwWA83J
---
1) Create `apps/api/src/services/team-status/index.ts` with a `TeamStatusService` class following the existing service pattern (see TraceService/EscalationService). It should: track agent activity timestamps internally when `agent:working`/`agent:idle` events fire; expose `getFormattedStatus(excludeAgentId: string): string` that builds a markdown block like '## Team Status\n- Fry is working on Add login page (branch: task/task-abc)\n...'. Use `agentWorker.getStatus()` (returns `Record<string, { activeTask, queueLength }>`) plus task store to get task titles/branches. Return empty string when no other agents are active. Skip agents idle >30min. 2) Wire into `apps/api/src/services/agent-worker/index.ts` at ~line 554-555: after the skills prompt and before the summary instruction, call `teamStatusService.getFormattedStatus(agentId)` and append to systemPrompt if non-empty. 3) Initialize TeamStatusService in the app bootstrap and pass it to the agent worker config.

---
**[2026-03-31 22:35:37]** 🚀 Bender started working on this task.
**[2026-03-31 22:35:37]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 22:41:18]** 🚀 Bender started working on this task.
**[2026-03-31 22:41:18]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 22:41:20]** 🚀 Bender started working on this task.
**[2026-03-31 22:41:20]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 22:41:20]** 🚀 Bender started working on this task.
**[2026-03-31 22:41:20]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 22:41:21]** 🚀 Bender started working on this task.
**[2026-03-31 22:41:21]** 🎚️ Response tier: **standard** — Multi-agent coordination (maxAgents: 2)

---
**[2026-03-31 22:41:21]** 🛑 Permanently blocked after 5 failed attempts.
