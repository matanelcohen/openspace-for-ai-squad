---
id: task-CGApkNaT
title: Add hard budget limits that stop agent execution
status: done
priority: P1
assignee: leela
labels: []
created: '2026-03-31T21:11:39.456Z'
updated: '2026-03-31T21:51:05.106Z'
sortIndex: 162
---
Implement real budget enforcement in the agent worker. Track cumulative cost per agent and per day from the CostService. Before each agenticCompletion call, check if budget is exceeded. If so: 1) Block execution, 2) Mark task as blocked with reason, 3) Emit escalation, 4) Notify via WebSocket. Config in squad.config.ts: budget: { dailyLimit: 50, perAgentLimit: 20, perTaskLimit: 10 } (in dollars). Show budget status on the cost dashboard.

---
**[2026-03-31 21:34:52]** 📋 Leela analyzed this task but couldn't break it down.

**Analysis:**
**Budget Limits — dispatched.** Here's the breakdown:

| Sub-task | Assignee | Status |
|----------|----------|--------|
| Backend: budget config + CostService methods + enforcement in AgentWorker + WebSocket events + API endpoint | **Bender** | 🔨 Working |
| Frontend: `useBudget` hook + budget progress bars + blocked task alerts + WebSocket toasts | **Fry** | 🔨 Working |
| Testing: budget enforcement tests | **Zoidberg** | ⏳ After backend |

**Key design decisions:**
- Budget check happens **before** each `agenticCompletion` call in `processNext()`
- Three limits: daily ($50), per-agent ($20), per-task ($10) — configurable in `squad.config.ts`
- Exceeded → task blocked + escalation + WebSocket broadcast
- Dashboard shows color-coded progress bars (green/yellow/red at 70%/90% thresholds)

Both agents are working in parallel. I'll review their output when they complete and then dispatch Zoidberg for tests.
